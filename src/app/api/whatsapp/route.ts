import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { aiService } from "@/services/aiService";

export const dynamic = 'force-dynamic';

// Interface para estruturar o corpo da requisição do WhatsApp
interface WhatsAppRequestBody {
  phone: string;
  text: string;
}

// Fallback manual para reconstruir o estado financeiro caso a RPC get_financial_state_v5 falhe
async function buildFinancialStateFallback(supabase: any, userId: string) {
  const [
    accountsRes,
    categoriesRes,
    transactionsRes,
    profileRes,
  ] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('categories').select('*').or(`user_id.eq.${userId},is_system_default.eq.true`).order('name'),
    supabase.from('transactions').select('*, categories(name, type)').eq('user_id', userId).order('date', { ascending: false }).limit(20),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
  ]);

  const accounts = accountsRes.data || [];
  const categories = categoriesRes.data || [];
  const transactions = transactionsRes.data || [];
  const profile = profileRes.data || {};

  return {
    user_profile: {
      monthly_income_cents: profile?.monthly_income_cents || 0,
      fixed_expenses_cents: profile?.fixed_expenses_cents || 0,
      accumulated_balance_cents: accounts
        .filter((a: any) => a.type !== "CREDIT_CARD")
        .reduce((sum: number, a: any) => sum + (Number(a.balance_cents) || 0), 0),
    },
    accounts,
    categories,
    transactions,
  };
}

export async function POST(request: NextRequest) {
  // 1. Validar o token secreto de segurança
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");
  const secretHeader = request.headers.get("x-whatsapp-secret");
  
  const expectedSecret = process.env.WHATSAPP_WEBHOOK_SECRET || "vesper_jarvis_whatsapp_secret_key_123";
  
  if (secretParam !== expectedSecret && secretHeader !== expectedSecret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    // 2. Extrair phone e text do payload
    const body: WhatsAppRequestBody = await request.json();
    const { phone, text } = body;

    if (!phone || !text) {
      return NextResponse.json({ error: "Parâmetros phone e text são obrigatórios." }, { status: 400 });
    }

    // 3. Higienizar número de telefone (manter apenas dígitos)
    const sanitizedPhone = phone.replace(/\D/g, "");

    const supabase = await createAdminClient();

    // 4. Buscar usuário pelo número de WhatsApp registrado na tabela profiles
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("whatsapp_number", sanitizedPhone)
      .maybeSingle();

    if (profileError) {
      console.error("Erro ao buscar profile por whatsapp_number:", profileError.message);
      return NextResponse.json({ error: "Erro ao consultar banco de dados." }, { status: 500 });
    }

    // Se o telefone não for encontrado, responder com instruções amigáveis em plain text
    if (!profileData) {
      const responseText = `OLÁ! AQUI É A VESPER FINANCE.

NÃO ENCONTREI NENHUM CONTA VINCULADA A ESTE NÚMERO DE WHATSAPP.

PARA INTEGRAR SEU WHATSAPP COM A VESPER FINANCE E CONTROLAR SUAS FINANÇAS DIRETAMENTE POR AQUI DE FORMA INSTANTÂNEA, SIGA ESTES PASSOS:

1. ACESSE O SISTEMA VESPER FINANCE NO SEU COMPUTADOR OU CELULAR.
2. VÁ NA ABA DE CONFIGURAÇÕES.
3. CADASTRE O NÚMERO DO SEU CELULAR NO CAMPO DE WHATSAPP (EX: ${sanitizedPhone || "5511999999999"}).
4. SALVE AS ALTERAÇÕES E MANDE UM OI NOVAMENTE POR AQUI!

SE PRECISAR DE AJUDA, ESTAMOS À DISPOSIÇÃO!`;

      return NextResponse.json({ responseText });
    }

    const userId = profileData.id;

    // 5. Salvar a mensagem recebida do usuário no histórico de chat
    await supabase.from("chat_memory").insert({
      session_id: userId,
      message: { role: "user", text }
    });

    // 6. Carregar estado financeiro do usuário
    let financialData: any = null;
    try {
      const { data, error } = await supabase.rpc('get_financial_state_v5', { p_user_id: userId });
      if (!error && data) {
        financialData = data;
      }
    } catch (rpcErr) {
      console.warn("RPC get_financial_state_v5 falhou no webhook de WhatsApp, usando fallback:", rpcErr);
    }

    if (!financialData) {
      financialData = await buildFinancialStateFallback(supabase, userId);
    }

    // 7. Formatar contexto financeiro para injetar no prompt
    const accounts = financialData.accounts || [];
    const categories = financialData.categories || [];
    
    const accountsSummary = accounts.map((a: any) => 
      `- Conta: ${a.name} | Tipo: ${a.type} | Saldo: R$ ${(a.balance_cents / 100).toFixed(2)} | ID da Conta: ${a.id}`
    ).join("\n");

    const categoriesSummary = categories.map((c: any) => 
      `- Categoria: ${c.name} | Tipo: ${c.type} | ID da Categoria: ${c.id}`
    ).join("\n");

    const recentTransactionsSummary = (financialData.transactions || []).slice(0, 10).map((t: any) => 
      `- Data: ${t.date.split("T")[0]} | Descrição: ${t.description} | Valor: R$ ${(t.amount_cents / 100).toFixed(2)} | Tipo: ${t.transaction_type}`
    ).join("\n");

    // 8. Buscar memórias de longo prazo (fatos cognitivos)
    const { data: memoryRows } = await supabase
      .from("chat_memory")
      .select("message")
      .eq("session_id", `memory_${userId}`)
      .limit(1);

    let existingFacts: string[] = [];
    let existingGrouped = {
      profile: [] as string[],
      goals: [] as string[],
      fears: [] as string[],
      preferences: [] as string[]
    };

    if (memoryRows && memoryRows.length > 0) {
      const msgContent = memoryRows[0].message;
      if (msgContent.facts) {
        existingFacts = msgContent.facts;
        existingGrouped.goals = msgContent.facts;
      } else {
        existingGrouped = {
          profile: msgContent.profile || [],
          goals: msgContent.goals || [],
          fears: msgContent.fears || [],
          preferences: msgContent.preferences || []
        };
        existingFacts = [
          ...existingGrouped.profile,
          ...existingGrouped.goals,
          ...existingGrouped.fears,
          ...existingGrouped.preferences
        ];
      }
    }

    let cognitiveMemoryContext = "";
    if (existingFacts.length > 0) {
      cognitiveMemoryContext = `
=== MEMÓRIA COGNITIVA E FATOS DE LONGO PRAZO ===
Você aprendeu estes fatos importantes sobre a vida financeira do usuário. Utilize-os para demonstrar empatia e hiperpersonalizar suas análises:
- PERFIL E RENDA: ${existingGrouped.profile.join(", ") || "Nenhum fato registrado"}
- OBJETIVOS E SONHOS: ${existingGrouped.goals.join(", ") || "Nenhum fato registrado"}
- PREOCUPAÇÕES E DORES: ${existingGrouped.fears.join(", ") || "Nenhum fato registrado"}
- PREFERÊNCIAS DE DECISÃO: ${existingGrouped.preferences.join(", ") || "Nenhum fato registrado"}
`;
    }

    // 9. Montar Prompt do Sistema otimizado para WhatsApp (Sem formatação Markdown)
    const systemPrompt = `Você é o Jarvis, um mentor financeiro ultra-empático, prático e analítico integrado à plataforma de finanças Vesper Finance, operando diretamente pelo WhatsApp.

Sua missão é dar suporte a usuários respondendo suas perguntas financeiras, analisando simulações de gastos/créditos e lançando novas transações fisicamente no banco de dados de forma automatizada através da interpretação da linguagem natural.

DIRETRIZES DE COMUNICAÇÃO (OBRIGATÓRIO):
1. EMPATIA RADICAL: Use linguagem acolhedora, natural e sem julgamentos. Jamais dê lições de moral sobre escolhas erradas.
2. SEM FORMATÇÃO MARKDOWN: NUNCA use formatação markdown de títulos (caracteres #, ## ou ###) ou negrito/itálico (caracteres * ou **). Escreva suas respostas apenas em texto puro (plain text), limpo, legível e direto. Para destacar seções ou títulos importantes, use LETRAS MAIÚSCULAS no início de uma linha nova e parágrafos bem espaçados com quebras de linha duplas, ou marcadores simples como traços (-) e números (1., 2.).
3. IDIOMA: Português do Brasil (pt-BR).

DIRETRIZES DE PROCESSAMENTO DE TRANSAÇÕES E SIMULAÇÕES:
- Se o usuário reportar uma transação física ocorrida de forma clara (ex: "gastei 8.50 no salgado no nubank", "compra de 350 reais parcelado em 3x no inter", "recebi 2500 pix"), você deve inferir os dados corretos e retornar um bloco XML <vesper-simulation> com "persist": true para cadastrar no banco.
- Se o usuário estiver fazendo uma pergunta opinativa, tirando dúvida ou simulando um cenário futuro hipotético (ex: "posso comprar um celular de 3000 em 12x?", "se eu financiar um carro agora, qual o impacto?"), você deve estimar os impactos reais com base no caixa disponível do usuário, fazer as projeções, e retornar um bloco XML <vesper-simulation> com "persist": false para apenas simular sem alterar o saldo real!
- Para transações de cartão de crédito (EXPENSE em conta do tipo CREDIT_CARD), a transação nascerá não paga (is_paid: false). Para contas de débito/corrente comuns, nascerá paga (is_paid: true).
- No bloco XML, você DEVE retornar a chave 'accountId' com o ID exato da conta bancária identificada de acordo com as contas disponíveis abaixo. Se a conta não for informada, use fallbacks razoáveis.
- No bloco XML, você DEVE retornar a chave 'categoryId' com o ID exato da categoria associada de acordo com as categorias disponíveis abaixo.

FORMATO OBRIGATÓRIO DO BLOCO XML DE SIMULAÇÃO:
<vesper-simulation>
{
  "type": "expense", // "expense" ou "loan"
  "title": "Nome curto da simulação ou gasto",
  "amount": 8.50, // valor total em reais (float)
  "installments": 1, // quantidade de parcelas (inteiro)
  "interestRate": 0, // juros se aplicável (float %)
  "customInstallment": 8.50, // valor exato da parcela mensal prometido no texto (float)
  "description": "Breve descrição do gasto ou simulação",
  "impactAnalysis": "Análise concisa de impacto no fluxo de caixa",
  "accountId": "id_da_conta_selecionada",
  "categoryId": "id_da_categoria_selecionada",
  "persist": true // true para gravar transação no banco físico, false para simular sem persistir
}
</vesper-simulation>

IMPORTANTE: NÃO coloque crases de marcação de código markdown (como \`\`\`json) dentro do bloco XML de vesper-simulation. Apenas o JSON cru e válido imediatamente.

CONSOLIDAÇÃO DE MEMÓRIAS COGNITIVAS:
Monitore atentamente a conversa para identificar novos fatos importantes e duradouros sobre a vida e finanças do usuário. Se identificar novos fatos, ou se precisar consolidar a lista existente de fatos lembrados, você DEVE retornar a lista COMPLETA de fatos atualizados agrupada em caixinhas no final de sua resposta dentro da tag XML de memória cognitiva, sem crases markdown de código:
<vesper-cognitive-memory>
{
  "profile": ["Renda de R$ 2.124,00 e sem reserva de emergência"],
  "goals": ["Deseja economizar para notebook de R$ 1.200"],
  "fears": ["Preocupado com o rombo de junho de R$ 1.232,28"],
  "preferences": ["Prefere parcelar empréstimo para manter parcela abaixo de R$ 250"]
}
</vesper-cognitive-memory>

=== CONTAS BANCÁRIAS DISPONÍVEIS ===
${accountsSummary}

=== CATEGORIAS DE LANÇAMENTO DISPONÍVEIS ===
${categoriesSummary}

=== HISTÓRICO DE TRANSAÇÕES RECENTES ===
${recentTransactionsSummary}
${cognitiveMemoryContext}
`;

    // 10. Carregar o histórico do chat recente do usuário para dar contexto à conversa
    const { data: historyRows } = await supabase
      .from("chat_memory")
      .select("message")
      .eq("session_id", userId)
      .order("id", { ascending: true });

    const recentHistory = (historyRows || []).slice(-15).map((row: any) => row.message);
    const chatMessages = recentHistory.map((msg: any) => ({
      role: (msg.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: msg.text
    }));

    // 11. Chamar o serviço de IA para obter a resposta cognitiva
    const aiReply = await aiService.getResponse(chatMessages, systemPrompt);

    let cleanReply = aiReply;

    // 12. Processar a tag <vesper-simulation> para persistir ou simular dados
    const simulationRegex = /<vesper-simulation>([\s\S]*?)<\/vesper-simulation>/;
    const simulationMatch = simulationRegex.exec(aiReply);

    if (simulationMatch) {
      try {
        const parsedSimulation = JSON.parse(simulationMatch[1].trim());
        
        // Se persist for true, salvar fisicamente no Supabase!
        if (parsedSimulation.persist === true) {
          const installments = Number(parsedSimulation.installments) || 1;
          const totalAmountCents = Math.round(parsedSimulation.amount * 100);
          const description = parsedSimulation.title || parsedSimulation.description || "Lançamento via WhatsApp";
          const accountId = parsedSimulation.accountId || (accounts[0]?.id || null);
          const categoryId = parsedSimulation.categoryId || (categories[0]?.id || null);

          // Verificar se a conta selecionada é de Cartão de Crédito para aplicar regra de pagamento
          let isCreditCard = false;
          if (accountId) {
            const selectedAccount = accounts.find((a: any) => a.id === accountId);
            if (selectedAccount?.type === 'CREDIT_CARD') {
              isCreditCard = true;
            }
          }

          if (installments > 1) {
            // Caso Parcelado: Criar uma série de parcelamento
            const amountPerInstallment = Math.round(totalAmountCents / installments);
            const groupId = crypto.randomUUID();
            const now = new Date();
            const startYear = now.getFullYear();
            const startMonth = now.getMonth();
            const startDay = now.getDate();
            const startHours = now.getHours();
            const startMinutes = now.getMinutes();

            const transactionsToInsert = [];

            for (let i = 0; i < installments; i++) {
              // Calcular a data de vencimento da parcela
              const targetMonthTotal = startMonth + i;
              const targetYear = startYear + Math.floor(targetMonthTotal / 12);
              const targetMonth = targetMonthTotal % 12;

              const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
              const finalDay = Math.min(startDay, lastDayOfTargetMonth);

              const date = new Date(targetYear, targetMonth, finalDay, startHours, startMinutes, 0, 0);
              const lastDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
              const isFuture = date > lastDayOfCurrentMonth;
              const resolvedIsPaid = isCreditCard ? false : !isFuture;

              transactionsToInsert.push({
                user_id: userId,
                description: `${description} (${i + 1}/${installments})`,
                amount_cents: amountPerInstallment,
                transaction_type: parsedSimulation.type === "loan" ? "INCOME" : "EXPENSE",
                date: date.toISOString(),
                account_id: accountId,
                category_id: categoryId,
                is_paid: resolvedIsPaid,
                installment_current: i + 1,
                installment_total: installments,
                installment_group_id: groupId,
                source: "WHATSAPP",
                updated_at: new Date().toISOString()
              });
            }

            // Inserir todas as parcelas no Supabase em lote
            const { error: batchError } = await supabase
              .from('transactions')
              .insert(transactionsToInsert);

            if (batchError) throw batchError;
            console.log(`✅ Inseridas ${installments} parcelas com sucesso para o usuário ${userId}`);
          } else {
            // Caso à Vista: Inserir uma única transação
            const now = new Date();
            const txData = {
              user_id: userId,
              account_id: accountId,
              category_id: categoryId,
              amount_cents: totalAmountCents,
              transaction_type: parsedSimulation.type === "loan" ? "INCOME" : "EXPENSE",
              date: now.toISOString(),
              description,
              installment_current: 1,
              installment_total: 1,
              is_paid: isCreditCard ? false : true,
              source: "WHATSAPP",
              updated_at: now.toISOString()
            };

            const { error: txError } = await supabase
              .from('transactions')
              .insert(txData);

            if (txError) throw txError;
            console.log(`✅ Inserida transação à vista com sucesso para o usuário ${userId}`);
          }
        }
      } catch (simErr) {
        console.error("Erro ao analisar ou persistir transação via WhatsApp:", simErr);
      } finally {
        // Remover a tag XML da resposta de texto limpa final que será enviada ao WhatsApp
        cleanReply = cleanReply.replace(simulationMatch[0], "").trim();
      }
    }

    // 13. Processar a tag <vesper-cognitive-memory> para atualizar memórias cognitivas
    const cognitiveRegex = /<vesper-cognitive-memory>([\s\S]*?)<\/vesper-cognitive-memory>/;
    const cognitiveMatch = cognitiveRegex.exec(aiReply);

    if (cognitiveMatch) {
      try {
        const parsedMemory = JSON.parse(cognitiveMatch[1].trim());
        let updatedPayload: any = {};

        if (parsedMemory && typeof parsedMemory === "object") {
          const profile = Array.isArray(parsedMemory.profile) ? parsedMemory.profile.map((f: any) => String(f).trim()).filter(Boolean) : [];
          const goals = Array.isArray(parsedMemory.goals) ? parsedMemory.goals.map((f: any) => String(f).trim()).filter(Boolean) : [];
          const fears = Array.isArray(parsedMemory.fears) ? parsedMemory.fears.map((f: any) => String(f).trim()).filter(Boolean) : [];
          const preferences = Array.isArray(parsedMemory.preferences) ? parsedMemory.preferences.map((f: any) => String(f).trim()).filter(Boolean) : [];

          updatedPayload = {
            profile,
            goals,
            fears,
            preferences,
            last_updated: new Date().toISOString()
          };
        }

        // Salvar ou atualizar memórias no Supabase
        const { data: existingMemory } = await supabase
          .from("chat_memory")
          .select("id")
          .eq("session_id", `memory_${userId}`)
          .limit(1);

        if (existingMemory && existingMemory.length > 0) {
          await supabase
            .from("chat_memory")
            .update({ message: updatedPayload })
            .eq("id", existingMemory[0].id);
        } else {
          await supabase
            .from("chat_memory")
            .insert({
              session_id: `memory_${userId}`,
              message: updatedPayload
            });
        }
      } catch (memErr) {
        console.error("Erro ao processar e salvar memórias cognitivas via WhatsApp:", memErr);
      } finally {
        // Remover a tag XML do texto final
        cleanReply = cleanReply.replace(cognitiveMatch[0], "").trim();
      }
    }

    // 14. Salvar a resposta limpa da IA no histórico de chat
    await supabase.from("chat_memory").insert({
      session_id: userId,
      message: { role: "model", text: cleanReply }
    });

    // 15. Retornar a resposta em formato JSON para o n8n
    return NextResponse.json({ responseText: cleanReply });

  } catch (error: any) {
    console.error("Erro interno no endpoint do WhatsApp:", error);
    return NextResponse.json({ error: error.message || "Erro interno do servidor." }, { status: 500 });
  }
}

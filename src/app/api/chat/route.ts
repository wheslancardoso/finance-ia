import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/utils/supabase/server";
import { aiService } from "@/services/aiService";

export const dynamic = 'force-dynamic';

async function getAuthUser() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

// Handler GET: Carrega o histórico e as memórias cognitivas do Supabase
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const supabase = await createAdminClient();

    // 1. Buscar histórico de conversas do usuário logado
    const { data: historyRows, error: historyError } = await supabase
      .from("chat_memory")
      .select("message")
      .eq("session_id", user.id)
      .order("id", { ascending: true });

    if (historyError) {
      throw new Error(`Erro ao buscar histórico: ${historyError.message}`);
    }

    const history = (historyRows || []).map((row: any) => row.message);

    // 2. Buscar memórias de longo prazo (fatos cognitivos)
    const { data: memoryRows, error: memoryError } = await supabase
      .from("chat_memory")
      .select("message")
      .eq("session_id", `memory_${user.id}`)
      .limit(1);

    if (memoryError) {
      throw new Error(`Erro ao buscar memórias cognitivas: ${memoryError.message}`);
    }

    const message = memoryRows && memoryRows.length > 0 ? memoryRows[0].message : null;
    let memoryFacts: string[] = [];
    let groupedFacts = {
      profile: [] as string[],
      goals: [] as string[],
      fears: [] as string[],
      preferences: [] as string[]
    };

    if (message) {
      if (message.profile || message.goals || message.fears || message.preferences) {
        groupedFacts = {
          profile: message.profile || [],
          goals: message.goals || [],
          fears: message.fears || [],
          preferences: message.preferences || []
        };
        memoryFacts = [
          ...groupedFacts.profile,
          ...groupedFacts.goals,
          ...groupedFacts.fears,
          ...groupedFacts.preferences
        ];
      } else if (message.facts) {
        memoryFacts = message.facts;
        groupedFacts.goals = message.facts;
      }
    }

    return NextResponse.json({ history, memoryFacts, groupedFacts });
  } catch (error: any) {
    console.error("Erro ao obter histórico do chat:", error);
    return NextResponse.json({ error: error.message || "Erro interno do servidor" }, { status: 500 });
  }
}

// Handler DELETE: Limpa o histórico de chat (e opcionalmente as memórias de longo prazo)
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const resetAll = searchParams.get("reset_all") === "true";

  try {
    const supabase = await createAdminClient();

    // 1. Deletar histórico de conversas normais
    const { error: deleteHistoryError } = await supabase
      .from("chat_memory")
      .delete()
      .eq("session_id", user.id);

    if (deleteHistoryError) {
      throw new Error(`Erro ao deletar histórico: ${deleteHistoryError.message}`);
    }

    // 2. Opcional: deletar memórias de longo prazo (fatos consolidados)
    if (resetAll) {
      const { error: deleteMemoryError } = await supabase
        .from("chat_memory")
        .delete()
        .eq("session_id", `memory_${user.id}`);

      if (deleteMemoryError) {
        throw new Error(`Erro ao deletar memórias de longo prazo: ${deleteMemoryError.message}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao resetar histórico do chat:", error);
    return NextResponse.json({ error: error.message || "Erro interno do servidor" }, { status: 500 });
  }
}

// Handler POST: Processa a nova mensagem, grava histórico, atualiza e injeta memórias
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { message, monthOffset, monthLabel, projectionSummary } = body;

    if (!message) {
      return NextResponse.json({ error: "Mensagem é obrigatória" }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // 1. Gravar a nova mensagem do usuário no banco de dados imediatamente
    const { error: saveUserMsgError } = await supabase
      .from("chat_memory")
      .insert({
        session_id: user.id,
        message: { role: "user", text: message }
      });

    if (saveUserMsgError) {
      console.error("Erro ao salvar mensagem do usuário:", saveUserMsgError.message);
    }

    // 2. Buscar dados financeiros reais do usuário no Supabase
    const { data: financialData, error: dbError } = await supabase.rpc('get_financial_state_v5', { p_user_id: user.id });

    if (dbError) {
      console.error("Erro ao buscar dados para o chatbot:", dbError.message);
    }

    // 3. Formatar resumo do estado financeiro real como contexto de sistema
    let financialContext = "Nenhum dado financeiro disponível.";
    if (financialData) {
      const accountsSummary = (financialData.accounts || []).map((a: any) => 
        `- Conta: ${a.name} | Tipo: ${a.type} | Saldo: R$ ${(a.balance_cents / 100).toFixed(2)} | Limite de Crédito: R$ ${(a.credit_limit_cents / 100).toFixed(2)}`
      ).join("\n");

      const invoicesSummary = (financialData.invoices || []).map((i: any) => 
        `- Fatura: Mês ${i.reference_month} | Status: ${i.status} | Valor: R$ ${(i.amount_cents / 100).toFixed(2)}`
      ).join("\n");

      const recentTransactionsSummary = (financialData.transactions || []).slice(0, 15).map((t: any) => 
        `- Data: ${t.date.split("T")[0]} | Descrição: ${t.description} | Valor: R$ ${(t.amount_cents / 100).toFixed(2)} | Tipo: ${t.transaction_type} | Paga: ${t.is_paid ? "Sim" : "Não"}`
      ).join("\n");

      const recurringSummary = (financialData.recurring_transactions || []).map((r: any) => 
        `- Recorrência: ${r.description} | Valor: R$ ${(r.amount_cents / 100).toFixed(2)} | Tipo: ${r.transaction_type} | Status: ${r.status}`
      ).join("\n");

      financialContext = `
=== ESTADO FINANCEIRO REAL DO USUÁRIO ===
CONTAS BANCÁRIAS E SALDOS:
${accountsSummary}

FATURAS E DÍVIDAS DE CARTÃO DE CRÉDITO:
${invoicesSummary}

TRANSAÇÕES RECENTES (ÚLTIMAS 15):
${recentTransactionsSummary}

COMPROMISSOS E RECORRÊNCIAS:
${recurringSummary}
`;
    }

    // Contexto Temporal opcional passado pelo frontend (Time Machine)
    let temporalContext = "";
    if (monthLabel) {
      temporalContext = `
=== CONTEXTO TEMPORAL (TIME MACHINE) ===
O usuário está visualizando a projeção futura na máquina do tempo!
Mês Ativo de Análise: ${monthLabel}
Meses de deslocamento no futuro: ${monthOffset ?? 0}
`;
    }

    if (projectionSummary) {
      temporalContext += `
VALORES FINANCEIROS CONTEXTUAIS DA TELA DO MÊS DE ${monthLabel || "HOJE"}:
- Liquidez Projetada ao Fim do Mês: R$ ${(projectionSummary.netLiquidityCents / 100).toFixed(2)}
- Saldo Bancário Real Disponível (Caixa): R$ ${(projectionSummary.accumulatedBalanceCents / 100).toFixed(2)}
- Limite de Oxigênio Semanal Saudável: R$ ${(projectionSummary.weeklyLimitCents / 100).toFixed(2)}
- Total de Compromissos/Despesas Agendadas do Mês: R$ ${(projectionSummary.plannedExpensesCents / 100).toFixed(2)}
- Situação do Caixa: ${projectionSummary.isCrisis ? "Alerta de Crise Ativo (Saldo negativo ou estressado)" : "Saldo Equilibrado ou sob Controle"}
`;
    }

    // 4. Buscar e carregar memórias cognitivas de longo prazo (fatos lembrados)
    const { data: memoryRows } = await supabase
      .from("chat_memory")
      .select("message")
      .eq("session_id", `memory_${user.id}`)
      .limit(1);

    let existingFacts: string[] = [];
    let existingGrouped = {
      profile: [] as string[],
      goals: [] as string[],
      fears: [] as string[],
      preferences: [] as string[]
    };

    if (memoryRows && memoryRows.length > 0) {
      const message = memoryRows[0].message;
      if (message.facts) {
        existingFacts = message.facts;
        existingGrouped.goals = message.facts;
      } else {
        existingGrouped = {
          profile: message.profile || [],
          goals: message.goals || [],
          fears: message.fears || [],
          preferences: message.preferences || []
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
Você aprendeu estes fatos importantes sobre a vida financeira do usuário, agrupados por categorias de caixinhas. Utilize-os para demonstrar empatia contínua, consistência temporal e hiperpersonalizar seus conselhos:

CATEGORIA: PERFIL E RENDA:
${existingGrouped.profile.length > 0 ? existingGrouped.profile.map(f => `- ${f}`).join("\n") : "- Nenhum fato registrado nesta categoria."}

CATEGORIA: OBJETIVOS E SONHOS:
${existingGrouped.goals.length > 0 ? existingGrouped.goals.map(f => `- ${f}`).join("\n") : "- Nenhum fato registrado nesta categoria."}

CATEGORIA: PREOCUPAÇÕES E DORES:
${existingGrouped.fears.length > 0 ? existingGrouped.fears.map(f => `- ${f}`).join("\n") : "- Nenhum fato registrado nesta categoria."}

CATEGORIA: PREFERÊNCIAS DE DECISÃO:
${existingGrouped.preferences.length > 0 ? existingGrouped.preferences.map(f => `- ${f}`).join("\n") : "- Nenhum fato registrado nesta categoria."}
`;
    }

    // 5. Montar prompt do sistema (System Prompt) com guardrails de empatia e mentoria
    const systemPrompt = `Você é o Vesper AI Copilot, um mentor financeiro ultra-empático, prático e realista integrado à plataforma de finanças inteligentes Vesper Finance.
Sua missão é dar suporte a usuários em momentos de alta vulnerabilidade, estresse financeiro e crise (como desemprego, endividamento de cartão de crédito e falta de liquidez).

Suas diretrizes de comportamento e comunicação são:
1. **Empatia Radical:** Use linguagem acolhedora, natural e sem julgamentos. Jamais dê lições de moral sobre escolhas erradas do passado ou compras por impulsividade (ex: cursos caros de informática, capacetes). Foque no que pode ser feito *agora*.
2. **Contexto Real do Usuário:** Abaixo são fornecidos os dados reais e consolidados das contas, faturas de cartão de crédito e transações do usuário. Baseie TODAS as suas análises nesses números exatos. Diga a ele o que você está enxergando.
3. **Análise Estratégica de Sobrevivência (Survival Mode):** 
   - Se o usuário precisar comprar itens essenciais de higiene/limpeza (como sabão de roupa, amaciante) e estiver sem saldo de conta corrente, ajude-o a planejar o uso seguro do limite de crédito restante.
   - Explique claramente as maracutaias de crédito de forma realista: pagar boleto com cartão de crédito ou fazer Pix Parcelado tem taxas/juros altíssimos (explique isso), mas se for a única opção para ele comprar itens de sobrevivência básica, ajude-o a escolher o menor dos males.
   - Forneça estratégias de rolagem de dívidas saudáveis (ex: priorizar moradia, contas básicas e alimentação sobre o pagamento total de faturas de juros altos caso ele não tenha dinheiro para pagar tudo).
   - **Explicação Didática de Valores / Projeções:** Se o usuário expressar dúvidas, confusão ou discrepâncias percebidas sobre os valores projetados de fim de mês ou de liquidez, explique didaticamente a matemática de forma clara, reconfortante e contextualizada ao mês ativo de análise na Time Machine. Por exemplo, mostre a ele que a 'Liquidez Projetada ao Fim do Mês' reflete o Saldo de Caixa real inicial (ex: R$ 413,00 hoje) somado à sua renda esperada daquele mês (ex: Salário de R$ 2.124,00 em junho) e subtraindo a fatura de cartão de crédito e todos os compromissos agendados e limites de categorias (budgets) planejados para o período ativo.
   - **Foco Inteligente no Déficit Mensal (Time Machine Context):** Seja inteligente e enxergue o futuro e o passado de forma integrada. O usuário entende que possui uma 'Dívida Total Consolidada' de longo prazo (ex: R$ 7.047,43 acumulados em parcelamentos nos cartões), mas sabe que ela NÃO vence inteira no mesmo mês. Por isso, NÃO dê recomendações ou puxe orelhas baseando-se estritamente na dívida total. Em vez disso, baseie todo o seu aconselhamento e simulações no **déficit ou gap financeiro real do mês ativo sob análise** (a 'Liquidez Projetada ao Fim do Mês', como o déficit de -R$ 1.232,28 em junho). O seu objetivo é ajudar o usuário a equilibrar o fluxo de caixa daquele mês específico para que ele continue respirando!
   - **Recomendação Concreta de Crédito/Empréstimo:** Quando o usuário simular empréstimos, sempre dê um veredito prático com números exatos. Não foque em mandar ele pagar a 'Dívida Total' inteira. Em vez disso, mire em cobrir o **déficit específico do mês ativo** (ex: o gap de R$ 1.232,28 em junho). Sugira pegar apenas o valor estritamente necessário para cobrir esse déficit (ex: um empréstimo simulado de cerca de R$ 1.300,00) e recomende uma quantidade de parcelas cuja prestação mensal seja tolerável e caiba com respiro no fluxo de caixa dele nos meses futuros (idealmente de R$ 150,00 a R$ 250,00 por mês, para não comprometer muito o seu salário líquido recorrente de R$ 2.124,00). Diga exatamente o que você faria no lugar dele com números precisos do mês ativo.
4. **Sem Ilusões:** Mantenha a clareza sobre riscos e custos, mas dê suporte emocional e prático. Mostre que é possível sair dessa situação e que o Vesper está aqui para guiá-lo.
5. **Tom e Formatação sem Markdown:** 
   - Use linguagem informal, próxima, profissional, compreensiva e no idioma Português do Brasil (pt-BR).
   - **MUITO IMPORTANTE - PROIBIDO MARKDOWN:** NUNCA use formatação markdown de títulos (caractere #, ## ou ###) ou formatação de negrito/itálico (caractere * ou **). Escreva suas respostas apenas em texto puro (plain text), limpo, legível e direto. Para destacar cabeçalhos ou seções, use apenas LETRAS MAIÚSCULAS no início de uma linha nova e parágrafos bem espaçados com quebras de linha duplas, ou marcadores limpos simples como traços (-) e números (1., 2.).
6. **Simulações de Compra/Crédito Interativas:**
   - Sempre que o usuário expressar interesse em comprar algo, simular uma despesa, planejar um gasto, ou discutir opções de empréstimo ou crédito, você DEVE emitir um bloco XML estruturado contendo a simulação exata em JSON no final de sua resposta.
   - O formato XML obrigatório é:
     <vesper-simulation>
     {
       "type": "expense", // "expense" para gastos comuns, "loan" para empréstimos/crédito
       "title": "Nome curto da simulação",
       "amount": 1200.00, // valor total em reais (float)
       "installments": 6, // quantidade de parcelas (inteiro)
       "interestRate": 0, // taxa de juros mensal para empréstimos, ou 0 para parcelamento sem juros (float %)
       "description": "Breve descrição do item ou crédito simulação.",
       "impactAnalysis": "Análise concisa de como esse valor impactará as finanças projetadas do mês ativo."
     }
     </vesper-simulation>
   - IMPORTANTE: NÃO coloque marcadores de bloco de código markdown (como tres crases e a palavra json) dentro do bloco XML de vesper-simulation. Coloque apenas o JSON cru e válido imediatamente.
7. **Consolidação de Memória de Longo Prazo (Fatos Cognitivos em Caixinhas):**
   - Monitore atentamente a conversa para identificar novos fatos importantes e duradouros sobre a vida e finanças do usuário.
   - Se identificar qualquer novo fato duradouro, ou se precisar consolidar/atualizar a lista existente de fatos lembrados, você DEVE retornar a lista COMPLETA de fatos atualizados agrupada em caixinhas (categorias) no final de sua resposta dentro de uma tag XML de memória cognitiva:
     <vesper-cognitive-memory>
     {
       "profile": ["Salário de R$ 2.124,00 e sem reserva de emergência"],
       "goals": ["Deseja economizar para notebook de estudos de R$ 1.200"],
       "fears": ["Preocupado com o rombo de junho de R$ 1.232,28"],
       "preferences": ["Prefere parcelar empréstimo para manter parcela abaixo de R$ 250"]
     }
     </vesper-cognitive-memory>
   - As categorias válidas de caixinhas são: "profile" (Perfil & Renda), "goals" (Objetivos & Sonhos), "fears" (Preocupações & Dores) e "preferences" (Preferências de Decisão).
   - Não adicione marcadores de código markdown (como crases ou json) dentro da tag de memória. Apenas o JSON válido.
   - Tente manter a lista de fatos sempre enxuta, com no máximo de 2 a 3 fatos curtos e diretos por caixinha, focando em dados úteis para orientar o suporte financeiro contínuo do Vesper.

Aqui está o contexto temporal e financeiro ativo:
${temporalContext}

Aqui está o contexto real das finanças consolidadas do banco de dados:
${financialContext}
${cognitiveMemoryContext}
`;

    // 6. Buscar o histórico completo atualizado (incluindo a mensagem recém salva do usuário)
    const { data: dbHistoryRows } = await supabase
      .from("chat_memory")
      .select("message")
      .eq("session_id", user.id)
      .order("id", { ascending: true });

    const dbHistory = (dbHistoryRows || []).map((row: any) => row.message);

    // 7. Mapear o histórico do banco de dados (incluindo a mensagem recém-salva do usuário) para a assinatura unificada
    const chatMessages = dbHistory.map((msg: any) => ({
      role: (msg.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: msg.text
    }));

    // 8. Chamar o serviço de IA modular (que seleciona e trata o provedor disponível de forma transparente)
    const reply = await aiService.getResponse(chatMessages, systemPrompt);
    
    // 9. Processar resposta para extrair fatos de memória cognitiva se existirem
    let cleanReply = reply;
    let newFacts: string[] = existingFacts;
    let newGroupedFacts = {
      profile: existingGrouped.profile,
      goals: existingGrouped.goals,
      fears: existingGrouped.fears,
      preferences: existingGrouped.preferences
    };

    const cognitiveRegex = /<vesper-cognitive-memory>([\s\S]*?)<\/vesper-cognitive-memory>/g;
    const cognitiveMatch = cognitiveRegex.exec(reply);

    if (cognitiveMatch) {
      try {
        const parsed = JSON.parse(cognitiveMatch[1].trim());
        let updatedMemoryPayload: any = {};

        if (Array.isArray(parsed)) {
          const flatFacts = parsed.map(f => String(f).trim()).filter(Boolean);
          newFacts = flatFacts;
          newGroupedFacts = {
            profile: [],
            goals: flatFacts,
            fears: [],
            preferences: []
          };
          updatedMemoryPayload = {
            profile: [],
            goals: flatFacts,
            fears: [],
            preferences: [],
            last_updated: new Date().toISOString()
          };
        } else if (parsed && typeof parsed === "object") {
          const profile = Array.isArray(parsed.profile) ? parsed.profile.map((f: any) => String(f).trim()).filter(Boolean) : [];
          const goals = Array.isArray(parsed.goals) ? parsed.goals.map((f: any) => String(f).trim()).filter(Boolean) : [];
          const fears = Array.isArray(parsed.fears) ? parsed.fears.map((f: any) => String(f).trim()).filter(Boolean) : [];
          const preferences = Array.isArray(parsed.preferences) ? parsed.preferences.map((f: any) => String(f).trim()).filter(Boolean) : [];

          newGroupedFacts = { profile, goals, fears, preferences };
          newFacts = [...profile, ...goals, ...fears, ...preferences];

          updatedMemoryPayload = {
            profile,
            goals,
            fears,
            preferences,
            last_updated: new Date().toISOString()
          };
        }

        if (newFacts.length > 0) {
          // Salvar ou atualizar no Supabase de forma segura
          const { data: existingMemory } = await supabase
            .from("chat_memory")
            .select("id")
            .eq("session_id", `memory_${user.id}`)
            .limit(1);

          if (existingMemory && existingMemory.length > 0) {
            await supabase
              .from("chat_memory")
              .update({
                message: updatedMemoryPayload
              })
              .eq("id", existingMemory[0].id);
          } else {
            await supabase
              .from("chat_memory")
              .insert({
                session_id: `memory_${user.id}`,
                message: updatedMemoryPayload
              });
          }
        }
        
        // Remover a tag XML do texto final visível
        cleanReply = cleanReply.replace(cognitiveMatch[0], "").trim();
      } catch (err) {
        console.error("Erro ao processar JSON de memórias cognitivas:", err);
      }
    }

    // 10. Gravar a resposta limpa da IA na tabela de histórico
    const { error: saveModelMsgError } = await supabase
      .from("chat_memory")
      .insert({
        session_id: user.id,
        message: { role: "model", text: cleanReply }
      });

    if (saveModelMsgError) {
      console.error("Erro ao salvar resposta da IA no histórico:", saveModelMsgError.message);
    }

    return NextResponse.json({ 
      response: cleanReply,
      memoryFacts: newFacts,
      groupedFacts: newGroupedFacts
    });

  } catch (error: any) {
    console.error("Erro no chatbot de IA:", error);
    return NextResponse.json({ error: error.message || "Erro interno do servidor" }, { status: 500 });
  }
}

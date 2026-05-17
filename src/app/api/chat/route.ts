import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/utils/supabase/server";

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

async function callGemini(contents: any[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada no ambiente.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API do Gemini: ${response.status} - ${errText}`);
  }

  const resJson = await response.json();
  const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Resposta inválida ou vazia do Gemini.");
  }

  return text;
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { message, history = [] } = body;

    if (!message) {
      return NextResponse.json({ error: "Mensagem é obrigatória" }, { status: 400 });
    }

    // 1. Buscar dados financeiros reais do usuário no Supabase
    const supabase = await createAdminClient();
    const { data: financialData, error: dbError } = await supabase.rpc('get_financial_state_v5', { p_user_id: user.id });

    if (dbError) {
      console.error("Erro ao buscar dados para o chatbot:", dbError.message);
    }

    // 2. Formatar resumo do estado financeiro real como contexto de sistema
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

    // 3. Montar prompt do sistema (System Prompt) com guardrails de empatia e mentoria
    const systemPrompt = `Você é o Vesper AI Copilot, um mentor financeiro ultra-empático, prático e realista integrado à plataforma de finanças inteligentes Vesper Finance.
Sua missão é dar suporte a usuários em momentos de alta vulnerabilidade, estresse financeiro e crise (como desemprego, endividamento de cartão de crédito e falta de liquidez).

Suas diretrizes de comportamento e comunicação são:
1. **Empatia Radical:** Use linguagem acolhedora, natural e sem julgamentos. Jamais dê lições de moral sobre escolhas erradas do passado ou compras por impulsividade (ex: cursos caros de informática, capacetes). Foque no que pode ser feito *agora*.
2. **Contexto Real do Usuário:** Abaixo são fornecidos os dados reais e consolidados das contas, faturas de cartão de crédito e transações do usuário. Baseie TODAS as suas análises nesses números exatos. Diga a ele o que você está enxergando.
3. **Análise Estratégica de Sobrevivência (Survival Mode):** 
   - Se o usuário precisar comprar itens essenciais de higiene/limpeza (como sabão de roupa, amaciante) e estiver sem saldo de conta corrente, ajude-o a planejar o uso seguro do limite de crédito restante.
   - Explique claramente as maracutaias de crédito de forma realista: pagar boleto com cartão de crédito ou fazer Pix Parcelado tem taxas/juros altíssimos (explique isso), mas se for a única opção para ele comprar itens de sobrevivência básica, ajude-o a escolher o menor dos males.
   - Forneça estratégias de rolagem de dívidas saudáveis (ex: priorizar moradia, contas básicas e alimentação sobre o pagamento total de faturas de juros altos caso ele não tenha dinheiro para pagar tudo).
4. **Sem Ilusões:** Mantenha a clareza sobre riscos e custos, mas dê suporte emocional e prático. Mostre que é possível sair dessa situação e que o Vesper está aqui para guiá-lo.
5. **Tom:** Informal, próximo, profissional, compreensivo e no idioma Português do Brasil (pt-BR).

Aqui está o contexto real das finanças dele:
${financialContext}
`;

    // 4. Formatar histórico de chat no padrão do Gemini
    const geminiContents = [];
    
    // Injetar o system instruction no primeiro prompt do chat para o Gemini 2.5
    geminiContents.push({
      role: "user",
      parts: [{ text: `${systemPrompt}\n\nMensagem do Usuário: ${message}` }]
    });

    // Chamar a API do Gemini
    const reply = await callGemini(geminiContents);
    
    return NextResponse.json({ response: reply });

  } catch (error: any) {
    console.error("Erro no chatbot de IA:", error);
    return NextResponse.json({ error: error.message || "Erro interno do servidor" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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

/**
 * Realiza a chamada HTTP nativa à API do Gemini 2.5 Flash
 */
async function callGemini(prompt: string): Promise<string> {
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
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
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

/**
 * Realiza a chamada HTTP nativa à API da OpenAI (GPT-4o-mini)
 */
async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada no ambiente.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API da OpenAI: ${response.status} - ${errText}`);
  }

  const resJson = await response.json();
  const text = resJson.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Resposta inválida ou vazia da OpenAI.");
  }

  return text;
}

/**
 * Dicionário de Mapeamentos de Categorias Padrão e Palavras-chave em Português
 */
const CATEGORY_MAPPINGS: { [key: string]: string[] } = {
  alimentacao: ["uber eats", "ifood", "restaurante", "padaria", "mercado", "supermercado", "comida", "alimento", "lanche", "janta", "almoco", "zaffari", "carrefour", "pao de acucar", "feira", "padaria", "cafe"],
  lazer: ["netflix", "spotify", "disney", "hbo", "prime video", "cinema", "show", "festa", "jogo", "ps5", "xbox", "steam", "viagem", "hotel", "balada", "cerveja", "chopp", "lazer", "entretenimento", "gaming", "ingresso"],
  transporte: ["uber", "99", "taxi", "gasolina", "combustivel", "carro", "moto", "pedagio", "onibus", "metro", "passagem", "estacionamento", "transporte", "blindado", "ipva", "oficina"],
  moradia: ["casa", "aluguel", "condominio", "luz", "energia", "agua", "gas", "internet", "eletricidade", "reforma", "moradia", "habitacao", "moveis", "decoracao"],
  saude: ["saude", "farmacia", "medico", "dentista", "consulta", "remedio", "hospital", "clinica", "drogaria", "exame", "psicologo", "terapia"],
  educacao: ["educacao", "curso", "faculdade", "escola", "livro", "mensalidade", "estudo", "material escolar", "facul"],
  eletronicos: ["notebook", "computador", "celular", "iphone", "tecnologia", "eletronico", "compras", "shopping", "roupa", "vestuario", "sapato", "tenis", "gadget", "pc", "hardware", "mouse", "teclado", "monitor", "compras", "eletronicos"],
  salario: ["salario", "receita", "rendimento", "freela", "recebi", "faturamento", "pro-labore", "venda", "reembolso", "bonus", "investimento", "pro labore", "salary", "income"]
};

/**
 * Fallback determinístico de correspondência de texto local se a IA estiver offline
 */
function localClassifyFallback(text: string, categories: any[]) {
  const cleanText = text.toLowerCase();
  let categoryId: string | null = null;
  let amountCents: number | null = null;

  // Inferência simples de valor em centavos
  const priceMatches = cleanText.match(/(?:r\$|brl)?\s*(\d+(?:[.,]\d{2})?)/);
  if (priceMatches && priceMatches[1]) {
    const value = parseFloat(priceMatches[1].replace(",", "."));
    if (!isNaN(value)) {
      amountCents = Math.round(value * 100);
    }
  }

  // Mapeamentos de categorias para termos
  const mappingKeys = Object.keys(CATEGORY_MAPPINGS);
  let matchedGroup: string | null = null;

  // Procura qual grupo de mapeamento combina com o texto inserido
  for (const group of mappingKeys) {
    const terms = CATEGORY_MAPPINGS[group];
    if (terms.some(term => cleanText.includes(term))) {
      matchedGroup = group;
      break;
    }
  }

  // Se casou com um grupo, procura na lista de categorias do usuário
  if (matchedGroup) {
    categoryId = categories.find(c => {
      const catName = c.name.toLowerCase();
      // Casamento por substring direta
      if (catName.includes(matchedGroup!) || matchedGroup!.includes(catName)) return true;
      
      // Casamento por sinônimos comuns do grupo
      if (matchedGroup === "eletronicos") {
        return catName.includes("tecnol") || catName.includes("compra") || catName.includes("eletr") || catName.includes("lazer") || catName.includes("outro");
      }
      if (matchedGroup === "alimentacao") {
        return catName.includes("alim") || catName.includes("merc") || catName.includes("comid") || catName.includes("outro");
      }
      if (matchedGroup === "lazer") {
        return catName.includes("laz") || catName.includes("entr") || catName.includes("assin") || catName.includes("outro");
      }
      if (matchedGroup === "transporte") {
        return catName.includes("trans") || catName.includes("viag") || catName.includes("outro");
      }
      if (matchedGroup === "moradia") {
        return catName.includes("mora") || catName.includes("habi") || catName.includes("casa") || catName.includes("alug") || catName.includes("outro");
      }
      if (matchedGroup === "saude") {
        return catName.includes("saud") || catName.includes("farm") || catName.includes("outro");
      }
      if (matchedGroup === "educacao") {
        return catName.includes("educ") || catName.includes("estud") || catName.includes("outro");
      }
      if (matchedGroup === "salario") {
        return catName.includes("sal") || catName.includes("recei") || catName.includes("rend") || catName.includes("outro");
      }
      return false;
    })?.id || null;
  }

  // Fallback padrão final se nada casar ou se o ID continuou nulo
  if (!categoryId && categories.length > 0) {
    const targetType = cleanText.includes("salario") || cleanText.includes("recebi") ? "INCOME" : "EXPENSE";
    const ofType = categories.find(c => c.type === targetType);
    categoryId = ofType ? ofType.id : categories[0].id;
  }

  // Higieniza descrição de forma sutil
  let description = text.trim();
  description = description.replace(/(?:r\$|brl)?\s*\d+(?:[.,]\d{2})?/gi, "").trim();
  if (!description) description = "Transação sem título";
  description = description.charAt(0).toUpperCase() + description.slice(1);

  return {
    description,
    amount_cents: amountCents,
    category_id: categoryId
  };
}

/**
 * POST /api/ia
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "Campo action é obrigatório" }, { status: 400 });
    }

    // Ação 1: Classificação Inteligente de Transação
    if (action === "classify-transaction") {
      const { text, categories = [] } = body;
      if (!text) {
        return NextResponse.json({ error: "Campo text é obrigatório para classificação" }, { status: 400 });
      }

      const hasGemini = !!process.env.GEMINI_API_KEY;
      const hasOpenAI = !!process.env.OPENAI_API_KEY;

      // Se nenhuma chave estiver configurada no .env, recorremos ao fallback determinístico de correspondência local
      if (!hasGemini && !hasOpenAI) {
        const fallbackResult = localClassifyFallback(text, categories);
        return NextResponse.json(fallbackResult);
      }

      try {
        const categoriesJson = JSON.stringify(categories.map((c: any) => ({ id: c.id, name: c.name, type: c.type })));
        const prompt = `Você é o motor analítico de classificação do Vesper Finance.
Dada a descrição de uma transação financeira livre do usuário: "${text}"
E a lista de categorias ativas dele: ${categoriesJson}

Analise a descrição e retorne estritamente um objeto JSON com os seguintes campos (sem nenhum markdown ou comentário extra):
- "description": Preserve obrigatoriamente os termos originais e a intenção detalhada informada pelo usuário, apenas capitalizando a primeira letra de cada palavra e limpando qualquer ruído de valores numéricos (R$, reais, brl) ou dados de parcelamento (ex: "Notebook de 4500 em 10x" vira "Notebook", "Exame de vista" vira "Exame de Vista"). NUNCA substitua a descrição por termos genéricos como "Consulta Médica" ou "Gasto Geral" se o usuário especificou o que comprou.
- "amount_cents": Valor total inferido em centavos de real (ex: R$ 45,50 vira 4550, "100" vira 10000). Retorne null se não for possível inferir nenhum valor numérico.
- "category_id": O "id" exato da categoria da lista fornecida que melhor se encaixa no tipo de gasto ou receita. Se nenhuma se encaixar perfeitamente, escolha a que tiver o tipo compatível ("INCOME" para receitas, "EXPENSE" para gastos) e que seja mais genérica.

Exemplo de saída esperada:
{"description":"Uber (Sábado)","amount_cents":4500,"category_id":"algum-id"}

Retorne APENAS o JSON puro estruturado sem markdown.`;

        let aiText = "";
        if (hasGemini) {
          aiText = await callGemini(prompt);
        } else {
          aiText = await callOpenAI(prompt);
        }

        const parsed = JSON.parse(aiText.trim());
        return NextResponse.json(parsed);
      } catch (error: any) {
        console.warn("[IA API Warning] Provedor de IA principal indisponível ou falhou, usando fallback local:", error.message);
        const fallbackResult = localClassifyFallback(text, categories);
        return NextResponse.json(fallbackResult);
      }
    }

    // Ação 2: Otimização de Metas
    if (action === "optimize-goals") {
      const { goals = [], financial_summary = {} } = body;

      const hasGemini = !!process.env.GEMINI_API_KEY;
      const hasOpenAI = !!process.env.OPENAI_API_KEY;

      // Se nenhuma chave estiver configurada, simulamos um conselho sutil de fallback local
      if (!hasGemini && !hasOpenAI) {
        const recommendations = goals.map((g: any, idx: number) => {
          const isEmergency = g.title.toLowerCase().includes("emerg") || g.title.toLowerCase().includes("reserv");
          return {
            goal_id: g.id,
            suggested_priority: isEmergency ? 1 : idx + 2,
            reason: isEmergency 
              ? "Recomendamos priorizar a Ambição de Emergência para consolidar seu Escudo de Sobrevivência antes de outros focos."
              : "Fila mantida. Blindagem operacional ativa."
          };
        });

        recommendations.sort((a: any, b: any) => a.suggested_priority - b.suggested_priority);
        recommendations.forEach((r: any, idx: number) => {
          r.suggested_priority = idx + 1;
        });

        return NextResponse.json({ recommendations });
      }

      try {
        const goalsJson = JSON.stringify(goals.map((g: any) => ({ id: g.id, title: g.title, target_cents: g.target_cents, priority: g.priority })));
        const summaryJson = JSON.stringify(financial_summary);

        const prompt = `Você é o Copiloto de Inteligência Artificial do Vesper Finance. Sua função é auditar a fila de prioridades de metas do usuário sob a ótica dos Tiers de Antifragilidade e Resiliência Financeira.

Metas Ativas do Usuário: ${goalsJson}
Resumo Financeiro Atual: ${summaryJson}

Avalie se a ordenação atual do usuário é ideal. As regras primordiais de antifragilidade financeira do Vesper são:
1. Proteger o Escudo de Sobrevivência (Reserva de Emergência que cobre custos ordinários) deve ser sempre o topo absoluto da prioridade.
2. Dívidas com altos juros devem ser quitadas antes de poupar para consumo supérfluo (Lazer/Viagens).
3. Metas menores ou próximas de conclusão podem ser aceleradas sutilmente para gerar streaks psicológicos de conquista.

Retorne um objeto JSON estrito com o seguinte formato (sem comentários ou markdown):
{
  "recommendations": [
    {
      "goal_id": "id-da-meta",
      "suggested_priority": 1,
      "reason": "Frase curta, clínica e fria justificando a recomendação (ex: 'Recomendamos priorizar o Escudo de Sobrevivência antes da meta de Lazer para blindar sua liquidez')"
    }
  ]
}

Retorne APENAS o objeto JSON estrito.`;

        let aiText = "";
        if (hasGemini) {
          aiText = await callGemini(prompt);
        } else {
          aiText = await callOpenAI(prompt);
        }

        const parsed = JSON.parse(aiText.trim());
        return NextResponse.json(parsed);
      } catch (error: any) {
        console.warn("[IA API Warning] Copiloto de IA falhou, simulando recomendação local:", error.message);
        const recommendations = goals.map((g: any, idx: number) => ({
          goal_id: g.id,
          suggested_priority: idx + 1,
          reason: "Fila mantida sob conformidade operacional de fallback."
        }));
        return NextResponse.json({ recommendations });
      }
    }

    // Ação 3: Análise Inteligente de Simulação
    if (action === "analyze-simulation") {
      const { simulation = {}, financial_summary = {} } = body;
      const hasGemini = !!process.env.GEMINI_API_KEY;
      const hasOpenAI = !!process.env.OPENAI_API_KEY;

      const runFallback = () => {
        const isExpense = simulation.type === "EXPENSE";
        const isLoan = simulation.loanInstallmentCents && simulation.loanInstallmentCents > 0;
        let advice = "";
        
        if (isLoan) {
          const rate = simulation.loan_monthly_interest_rate || 0;
          if (rate >= 12) {
            advice = `### ⚠️ Alerta de Risco: Juros Abusivos Detectados\n\nEssa simulação de empréstimo possui uma taxa implícita de **${rate.toFixed(2)}% a.m.**, o que é igual ou superior à taxa média do cartão rotativo (~12% a.m.). **Recomendamos fortemente evitar este empréstimo** e buscar alternativas como negociar parcelas diretas ou cortar gastos variáveis em até 15% para proteger seu caixa.`;
          } else {
            advice = `### 👍 Empréstimo Aceitável (Debt Swap)\n\nA taxa implícita dessa simulação é de **${rate.toFixed(2)}% a.m.**, o que é mais barato do que entrar no juro rotativo do cartão. O empréstimo ajudará a manter o saldo positivo no curto prazo, mas certifique-se de que a parcela de R$ ${(simulation.loanInstallmentCents / 100).toFixed(2)} não comprometa o sweep mensal para suas metas de longo prazo.`;
          }
        } else if (isExpense) {
          advice = `### 🔍 Análise de Despesa Proposta\n\nA despesa de **R$ ${(simulation.amount_cents / 100).toFixed(2)}** ${simulation.installments > 1 ? `parcelada em ${simulation.installments}x` : 'à vista'} impactará seu saldo mensal acumulado. Certifique-se de que este gasto é essencial neste ciclo de sobrevivência, ou tente adiar a compra para gerar uma amortização sweep extra de cartões.`;
        } else {
          advice = `### 🌟 Análise de Receita Simulado\n\nA receita proposta trará um respiro de liquidez imediata no caixa. Aproveite este saldo excedente para direcionar amortizações sweep para as faturas de cartão no final do mês.`;
        }
        return { advice };
      };

      if (!hasGemini && !hasOpenAI) {
        return NextResponse.json(runFallback());
      }

      try {
        const simJson = JSON.stringify(simulation);
        const summaryJson = JSON.stringify(financial_summary);

        const prompt = `Você é o Copiloto de Inteligência Artificial do Vesper Finance. Sua função é analisar detalhadamente o impacto de uma simulação ativa de despesa, receita ou empréstimo.

Parâmetros da Simulação Ativa: ${simJson}
Resumo Financeiro Atual do Usuário: ${summaryJson}

Gere um diagnóstico de viabilidade financeira empático, prático e objetivo de até 3 parágrafos curtos no formato Markdown. Explique a causalidade dessa simulação nas projeções da Time Machine do usuário. Destaque em negrito se a taxa de juros do empréstimo compensa contra o rotativo de 12% a.m. do cartão de crédito, o comprometimento de renda e proponha estratégias realistas de contingência se houver perigo.

Retorne estritamente um objeto JSON com o campo "advice" contendo o Markdown puro (sem blocos de código markdown ou json na resposta, apenas o json contendo o campo "advice"):
{
  "advice": "Markdown aqui com o diagnóstico..."
}

Retorne APENAS o JSON puro.`;

        let aiText = "";
        if (hasGemini) {
          aiText = await callGemini(prompt);
        } else {
          aiText = await callOpenAI(prompt);
        }

        const parsed = JSON.parse(aiText.trim());
        return NextResponse.json(parsed);
      } catch (error: any) {
        console.warn("[IA API Warning] Copiloto de IA para simulação falhou, usando fallback local:", error.message);
        return NextResponse.json(runFallback());
      }
    }

    // Ação 4: Decodificação Inteligente de Dilemas em Texto Livre
    if (action === "generate-scenario") {
      const { text, financial_summary = {} } = body;
      if (!text) {
        return NextResponse.json({ error: "Campo text é obrigatório para resolver dilema" }, { status: 400 });
      }

      const hasGemini = !!process.env.GEMINI_API_KEY;
      const hasOpenAI = !!process.env.OPENAI_API_KEY;

      const runFallback = () => {
        const cleanText = text.toLowerCase();
        let advice = "";
        const simulations: any[] = [];

        if (cleanText.includes("carro") || cleanText.includes("conserto") || cleanText.includes("quebrou")) {
          advice = `### 🔧 Dilema do Carro Quebrado\n\nEntendemos que problemas de locomoção são urgências críticas no ciclo de sobrevivência. Propomos simular uma despesa imediata de **R$ 1.500,00** para conserto em parcela única e, se necessário, simular uma receita compensatória para cobrir o rombo temporário no caixa.`;
          simulations.push({
            description: "Conserto do Carro",
            amount_cents: 150000,
            installments: 1,
            type: "EXPENSE"
          });
        } else if (cleanText.includes("computador") || cleanText.includes("notebook") || cleanText.includes("tv")) {
          advice = `### 💻 Dilema do Notebook / Tecnologia\n\nAdquirir eletrônicos pode ser essencial se for uma ferramenta de trabalho. Propomos planejar uma compra inteligente parcelada em **10x de R$ 200,00** (total de R$ 2.000,00) no cartão de crédito para suavizar a saída de caixa sem comprometer sua reserva imediata de sobrevivência.`;
          simulations.push({
            description: "Notebook Novo",
            amount_cents: 200000,
            installments: 10,
            type: "EXPENSE"
          });
        } else {
          advice = `### 💡 Conselho Geral do Copiloto Vesper\n\nAnalisamos seu dilema. Para ajudar a modelar seu cenário futuro na Time Machine, criamos uma simulação balanceada de contenção de despesas de **R$ 500,00** e uma receita temporária planejada de **R$ 1.000,00** para proteger sua liquidez.`;
          simulations.push({
            description: "Ajuda Planejada",
            amount_cents: 100000,
            installments: 1,
            type: "INCOME"
          });
        }

        return { advice, simulations };
      };

      if (!hasGemini && !hasOpenAI) {
        return NextResponse.json(runFallback());
      }

      try {
        const summaryJson = JSON.stringify(financial_summary);
        const prompt = `Você é o Copiloto de Inteligência Artificial do Vesper Finance. Sua função é interpretar o dilema em texto livre do usuário e modelar as simulações financeiras exatas correspondentes.

Dilema do Usuário: "${text}"
Resumo Financeiro Atual: ${summaryJson}

Analise a intenção e retorne estritamente um objeto JSON contendo:
- "advice": Um conselho estratégico acolhedor, prático e sem lições de moral em Markdown (2 parágrafos curtos) explicando como agir diante desse dilema e o impacto projetado.
- "simulations": Um array contendo até 3 simulações de receita/despesa para o simulador carregar na tela. Cada objeto do array deve ter obrigatoriamente os campos:
    - "description": Nome amigável higienizado (Ex: "Conserto do Carro").
    - "amount_cents": Valor total estimado da operação em centavos de real.
    - "installments": Número de parcelas (1 para à vista).
    - "type": "INCOME" para receitas/empréstimos e "EXPENSE" para despesas.

Retorne estritamente o objeto JSON (sem blocos de código markdown na resposta, apenas o json cru):
{
  "advice": "Markdown do conselho...",
  "simulations": [
    { "description": "Descrição", "amount_cents": 100000, "installments": 5, "type": "EXPENSE" }
  ]
}

Retorne APENAS o JSON puro.`;

        let aiText = "";
        if (hasGemini) {
          aiText = await callGemini(prompt);
        } else {
          aiText = await callOpenAI(prompt);
        }

        const parsed = JSON.parse(aiText.trim());
        return NextResponse.json(parsed);
      } catch (error: any) {
        console.warn("[IA API Warning] Copiloto de IA para dilemas falhou, usando fallback local:", error.message);
        return NextResponse.json(runFallback());
      }
    }

    // Ação 5: Otimização de Amortização Acelerada (Sweep das Metas)
    if (action === "optimize-sweep") {
      const { goals = [], budgets = [], financial_summary = {} } = body;
      const hasGemini = !!process.env.GEMINI_API_KEY;
      const hasOpenAI = !!process.env.OPENAI_API_KEY;

      const runFallback = () => {
        const advice = `### ⚡ Otimização de Amortização Acelerada (IA)

Analisamos seus orçamentos e despesas recorrentes ativas. Sugerimos cortes cirúrgicos de baixo impacto em categorias discricionárias para acelerar seu sweep:
1. **Reduzir Lazer/Assinaturas** em 15% (Economia de **R$ 80,00/mês**)
2. **Otimizar Alimentação/Delivery** cozinhando mais em casa (Economia de **R$ 120,00/mês**)

Isso libera uma sobra líquida mensal extra de **R$ 200,00** para direcionar inteiramente ao sweep de amortização de suas faturas, reduzindo drasticamente o tempo necessário para conquistar sua alforria financeira e voltar a focar 100% nas suas metas de investimento.`;

        return {
          advice,
          suggested_simulation: {
            description: "Amortização Acelerada (IA)",
            amount_cents: 20000,
            installments: 12,
            type: "INCOME"
          }
        };
      };

      if (!hasGemini && !hasOpenAI) {
        return NextResponse.json(runFallback());
      }

      try {
        const goalsJson = JSON.stringify(goals.map((g: any) => ({ id: g.id, title: g.name || g.title, target_cents: g.target_amount_cents, current_cents: g.current_amount_cents })));
        const budgetsJson = JSON.stringify(budgets.map((b: any) => ({ id: b.id, name: b.name, amount_cents: b.amount_cents })));
        const summaryJson = JSON.stringify(financial_summary);

        const prompt = `Você é o Copiloto de Inteligência Artificial do Vesper Finance. Sua função é auditar o orçamento consolidado, metas e sob-salários do usuário, propondo uma otimização de amortização acelerada (Sweep).

Metas do Usuário: ${goalsJson}
Orçamentos Ativos: ${budgetsJson}
Resumo Financeiro Atual: ${summaryJson}

Analise os orçamentos e despesas do usuário e proponha cortes cirúrgicos em categorias discricionárias (como lazer, delivery, compras supérfluas) que acumulem uma economia mensal prática. Explique como essa sobra mensal pode ser usada para amortizar faturas do cartão mais rápido.

Retorne estritamente um objeto JSON contendo:
- "advice": O conselho detalhado com foco clínico em Markdown (até 3 parágrafos curtos) listando os cortes propostos e a justificativa técnica.
- "suggested_simulation": Um objeto contendo a simulação exata correspondente a essa economia mensal, contendo os campos:
    - "description": "Amortização Acelerada (IA)"
    - "amount_cents": Valor consolidado economizado por mês em centavos de real (ex: R$ 250 por mês vira 25000).
    - "installments": 12 (para simular a redução por 12 meses na Time Machine).
    - "type": "INCOME" (pois a economia atua como receita livre que amplia o sweep de amortização de dívidas).

Retorne estritamente o objeto JSON no seguinte formato (sem blocos de código markdown ou texto extra):
{
  "advice": "Markdown do conselho...",
  "suggested_simulation": { "description": "Amortização Acelerada (IA)", "amount_cents": 25000, "installments": 12, "type": "INCOME" }
}

Retorne APENAS o JSON puro.`;

        let aiText = "";
        if (hasGemini) {
          aiText = await callGemini(prompt);
        } else {
          aiText = await callOpenAI(prompt);
        }

        const parsed = JSON.parse(aiText.trim());
        return NextResponse.json(parsed);
      } catch (error: any) {
        console.warn("[IA API Warning] Copiloto de IA para sweep falhou, usando fallback local:", error.message);
        return NextResponse.json(runFallback());
      }
    }

    return NextResponse.json({ error: "Ação não suportada" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/ia error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
 * Realiza a chamada HTTP nativa à API do Gemini 1.5 Flash
 */
async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada no ambiente.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
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

  // Correspondência simples de palavra-chave para categorias
  if (cleanText.includes("uber") || cleanText.includes("taxi") || cleanText.includes("gasolina") || cleanText.includes("combustivel") || cleanText.includes("carro")) {
    categoryId = categories.find(c => c.name.toLowerCase().includes("transp") || c.name.toLowerCase().includes("carro") || c.type === "EXPENSE")?.id || null;
  } else if (cleanText.includes("zaffari") || cleanText.includes("mercado") || cleanText.includes("supermercado") || cleanText.includes("comida") || cleanText.includes("alimento")) {
    categoryId = categories.find(c => c.name.toLowerCase().includes("alim") || c.name.toLowerCase().includes("mercado") || c.type === "EXPENSE")?.id || null;
  } else if (cleanText.includes("netflix") || cleanText.includes("spotify") || cleanText.includes("cinema") || cleanText.includes("lazer") || cleanText.includes("jogo") || cleanText.includes("ps5")) {
    categoryId = categories.find(c => c.name.toLowerCase().includes("laz") || c.name.toLowerCase().includes("assin") || c.type === "EXPENSE")?.id || null;
  } else if (cleanText.includes("salario") || cleanText.includes("receb") || cleanText.includes("pix") && cleanText.includes("recebi")) {
    categoryId = categories.find(c => c.name.toLowerCase().includes("sal") || c.name.toLowerCase().includes("recei") || c.type === "INCOME")?.id || null;
  }

  // Categoria fallback padrão se nada casar
  if (!categoryId && categories.length > 0) {
    const targetType = cleanText.includes("salario") || cleanText.includes("recebi") ? "INCOME" : "EXPENSE";
    categoryId = categories.find(c => c.type === targetType)?.id || categories[0].id;
  }

  // Higieniza descrição de forma sutil
  let description = text.trim();
  // Remove valor e "R$" da descrição
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

      // Se a chave não estiver configurada no .env, recorremos ao fallback determinístico de correspondência de strings local
      if (!process.env.GEMINI_API_KEY) {
        const fallbackResult = localClassifyFallback(text, categories);
        return NextResponse.json(fallbackResult);
      }

      try {
        const categoriesJson = JSON.stringify(categories.map((c: any) => ({ id: c.id, name: c.name, type: c.type })));
        const prompt = `Você é o motor analítico de classificação do Vesper Finance.
Dada a descrição de uma transação financeira livre do usuário: "${text}"
E a lista de categorias ativas dele: ${categoriesJson}

Analise a descrição e retorne estritamente um objeto JSON com os seguintes campos (sem nenhum markdown ou comentário extra):
- "description": Descrição higienizada de forma curta e formal (ex: "supermercado mensal 100" vira "Supermercado Mensal", "uber sabado" vira "Uber (Sábado)").
- "amount_cents": Valor total inferido em centavos de real (ex: R$ 45,50 vira 4550, "100" vira 10000). Retorne null se não for possível inferir nenhum valor numérico.
- "category_id": O "id" exato da categoria da lista fornecida que melhor se encaixa no tipo de gasto ou receita. Se nenhuma se encaixar perfeitamente, escolha a que tiver o tipo compatível ("INCOME" para receitas, "EXPENSE" para gastos) e que seja mais genérica.

Exemplo de saída esperada:
{"description":"Uber (Sábado)","amount_cents":4500,"category_id":"algum-id"}

Retorne APENAS o JSON puro estruturado sem markdown.`;

        const geminiText = await callGemini(prompt);
        const parsed = JSON.parse(geminiText.trim());
        return NextResponse.json(parsed);
      } catch (error: any) {
        console.warn("[IA API Warning] Gemini indisponível ou falhou, usando fallback local:", error.message);
        const fallbackResult = localClassifyFallback(text, categories);
        return NextResponse.json(fallbackResult);
      }
    }

    // Ação 2: Otimização de Metas
    if (action === "optimize-goals") {
      const { goals = [], financial_summary = {} } = body;

      // Se a chave não estiver configurada, simulamos um conselho sutil de fallback local
      if (!process.env.GEMINI_API_KEY) {
        const recommendations = goals.map((g: any, idx: number) => {
          const isEmergency = g.title.toLowerCase().includes("emerg") || g.title.toLowerCase().includes("reserv");
          return {
            goal_id: g.id,
            suggested_priority: isEmergency ? 1 : idx + 2, // Emergência assume prioridade máxima
            reason: isEmergency 
              ? "Recomendamos priorizar a Ambição de Emergência para consolidar seu Escudo de Sobrevivência antes de outros focos."
              : "Fila mantida. Blindagem operacional ativa."
          };
        });

        // Ordenar as recomendações para que a emergência com prioridade 1 vá para o topo
        recommendations.sort((a: any, b: any) => a.suggested_priority - b.suggested_priority);
        
        // Corrigir os índices sugeridos para sequencial de 1 a N
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
      "suggested_priority": 1, // 1 sendo a mais prioritária
      "reason": "Frase curta, clínica e fria justificando a recomendação (ex: 'Recomendamos priorizar o Escudo de Sobrevivência antes da meta de Lazer para blindar sua liquidez')"
    }
  ]
}

Retorne APENAS o objeto JSON estrito.`;

        const geminiText = await callGemini(prompt);
        const parsed = JSON.parse(geminiText.trim());
        return NextResponse.json(parsed);
      } catch (error: any) {
        console.warn("[IA API Warning] Gemini de metas falhou, simulando recomendação local:", error.message);
        const recommendations = goals.map((g: any, idx: number) => ({
          goal_id: g.id,
          suggested_priority: idx + 1,
          reason: "Fila mantida sob conformidade operacional de fallback."
        }));
        return NextResponse.json({ recommendations });
      }
    }

    return NextResponse.json({ error: "Ação não suportada" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/ia error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

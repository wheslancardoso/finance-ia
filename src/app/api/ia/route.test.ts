import { POST } from "./route";
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do cookies do Next.js
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => []
  })
}));

// Mock do Supabase Auth SSR
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user-id" } } })
    }
  })
}));

describe("API Route: /api/ia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GEMINI_API_KEY", ""); // Zera para forçar o fallback determinístico local nos testes convencionais
    vi.stubEnv("OPENAI_API_KEY", "");
  });

  it("deve retornar 400 se a action estiver faltando", async () => {
    const req = new NextRequest("http://localhost:3000/api/ia", {
      method: "POST",
      body: JSON.stringify({})
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("action é obrigatório");
  });

  it("deve classificar uma transação com sucesso usando o fallback determinístico local se GEMINI_API_KEY estiver vazia", async () => {
    const req = new NextRequest("http://localhost:3000/api/ia", {
      method: "POST",
      body: JSON.stringify({
        action: "classify-transaction",
        text: "uber 45",
        categories: [
          { id: "cat-1", name: "Transporte", type: "EXPENSE" },
          { id: "cat-2", name: "Alimentação", type: "EXPENSE" }
        ]
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBe("Uber");
    expect(data.amount_cents).toBe(4500);
    expect(data.category_id).toBe("cat-1");
  });

  it("deve otimizar a fila de metas com sucesso usando o fallback se GEMINI_API_KEY estiver vazia", async () => {
    const req = new NextRequest("http://localhost:3000/api/ia", {
      method: "POST",
      body: JSON.stringify({
        action: "optimize-goals",
        goals: [
          { id: "g-1", title: "Viagem", priority: 1 },
          { id: "g-2", title: "Reserva Emergência", priority: 2 }
        ]
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.recommendations).toHaveLength(2);
    expect(data.recommendations[0].goal_id).toBe("g-2"); // Reserva assume topo
  });

  it("deve analisar uma simulação com sucesso usando o fallback local se GEMINI_API_KEY estiver vazia", async () => {
    const req = new NextRequest("http://localhost:3000/api/ia", {
      method: "POST",
      body: JSON.stringify({
        action: "analyze-simulation",
        simulation: {
          type: "EXPENSE",
          amount_cents: 20000,
          installments: 1
        }
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.advice).toContain("Análise de Despesa Proposta");
  });

  it("deve resolver um dilema em texto livre com sucesso usando o fallback local se GEMINI_API_KEY estiver vazia", async () => {
    const req = new NextRequest("http://localhost:3000/api/ia", {
      method: "POST",
      body: JSON.stringify({
        action: "generate-scenario",
        text: "meu carro quebrou preciso de conserto"
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.advice).toContain("Dilema do Carro Quebrado");
    expect(data.simulations).toHaveLength(1);
    expect(data.simulations[0].description).toBe("Conserto do Carro");
  });

  it("deve emitir parecer Jarvis de crise com sucesso usando o fallback local se GEMINI_API_KEY estiver vazia", async () => {
    const req = new NextRequest("http://localhost:3000/api/ia", {
      method: "POST",
      body: JSON.stringify({
        action: "jarvis-advisor",
        goals: [
          { id: "g-1", name: "Notebook Novo", target_amount_cents: 200000, current_amount_cents: 0 }
        ],
        financial_summary: {
          net_liquidity_cents: -300000
        },
        simulation: {
          description: "Empréstimo Simulado",
          amount_cents: 150000,
          installments: 3,
          type: "INCOME"
        }
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.advice).toContain("Gabinete de Crise Jarvis");
    expect(data.suggested_loan_amount_cents).toBe(122000);
    expect(data.loan_verdict).toContain("Não compensa pegar R$ 1.500,00");
  });
});

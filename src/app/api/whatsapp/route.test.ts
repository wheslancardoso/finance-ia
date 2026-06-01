import { POST } from "./route";
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { aiService } from "@/services/aiService";

// Criar referências globais de mocks para espiar no teste sem problemas de hoisting do Vitest
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockResolvedValue({ error: null });
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "user-uuid-123", full_name: "Lan Cardoso" } }),
    limit: vi.fn().mockResolvedValue({ data: [] }),
    order: vi.fn().mockResolvedValue({ data: [] })
  })
});

const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  }),
  rpc: vi.fn().mockResolvedValue({
    data: {
      accounts: [
        { id: "acc-nubank", name: "Nubank", type: "CREDIT_CARD", balance_cents: -50000 },
        { id: "acc-itau", name: "Itaú", type: "CHECKING", balance_cents: 150000 }
      ],
      categories: [
        { id: "cat-alimentacao", name: "Alimentação", type: "EXPENSE" },
        { id: "cat-transporte", name: "Transporte", type: "EXPENSE" }
      ],
      transactions: []
    },
    error: null
  })
};

// Injetar nos globais para que vi.mock possa ler de forma segura e hoisted
(globalThis as any).__mockSupabase = mockSupabase;
(globalThis as any).__mockInsert = mockInsert;
(globalThis as any).__mockSelect = mockSelect;

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: vi.fn().mockImplementation(() => Promise.resolve((globalThis as any).__mockSupabase))
}));

vi.mock("@/services/aiService", () => ({
  aiService: {
    getResponse: vi.fn()
  }
}));

describe("API Route: /api/whatsapp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("WHATSAPP_WEBHOOK_SECRET", "vesper_jarvis_whatsapp_secret_key_123");
  });

  it("deve retornar 401 se o token secreto estiver incorreto ou ausente", async () => {
    const req = new NextRequest("http://localhost:3000/api/whatsapp?secret=token_errado", {
      method: "POST",
      body: JSON.stringify({ phone: "5511999999999", text: "oi" })
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Não autorizado");
  });

  it("deve retornar 400 se phone ou text estiverem faltando", async () => {
    const req = new NextRequest("http://localhost:3000/api/whatsapp?secret=vesper_jarvis_whatsapp_secret_key_123", {
      method: "POST",
      body: JSON.stringify({ phone: "5511999999999" })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Parâmetros phone e text são obrigatórios");
  });

  it("deve retornar instrução amigável de conexão se o telefone não estiver vinculado a nenhum perfil", async () => {
    // Forçar mock de profiles para retornar null (não cadastrado)
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValueOnce({
        maybeSingle: vi.fn().mockResolvedValueOnce({ data: null })
      })
    });

    const req = new NextRequest("http://localhost:3000/api/whatsapp?secret=vesper_jarvis_whatsapp_secret_key_123", {
      method: "POST",
      body: JSON.stringify({ phone: "5511888888888", text: "oi" })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.responseText).toContain("NÃO ENCONTREI NENHUM CONTA VINCULADA");
    expect(data.responseText).toContain("5511888888888");
  });

  it("deve processar uma mensagem padrão, obter resposta da IA e salvar no banco com sucesso", async () => {
    // Configurar IA para retornar uma resposta simples de texto sem tags XML
    vi.mocked(aiService.getResponse).mockResolvedValue("Olá! Em que posso ajudar hoje?");

    const req = new NextRequest("http://localhost:3000/api/whatsapp?secret=vesper_jarvis_whatsapp_secret_key_123", {
      method: "POST",
      body: JSON.stringify({ phone: "5511999999999", text: "Oi Jarvis!" })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.responseText).toBe("Olá! Em que posso ajudar hoje?");
    
    // Validar se salvou no banco de dados o histórico da conversa
    expect(mockInsert).toHaveBeenCalled();
  });

  it("deve processar um comando de despesa direta, realizar o parser XML e persistir a transação no Supabase se persist = true", async () => {
    // Configurar IA para retornar uma resposta com bloco de simulação ativo
    const aiResponse = `Entendido! Cadastrei o seu salgado de R$ 8.50 no cartão Nubank agora mesmo.
<vesper-simulation>
{
  "type": "expense",
  "title": "Salgado",
  "amount": 8.50,
  "installments": 1,
  "interestRate": 0,
  "customInstallment": 8.50,
  "description": "Lançamento de salgado",
  "impactAnalysis": "Redução pequena de caixa.",
  "accountId": "acc-nubank",
  "categoryId": "cat-alimentacao",
  "persist": true
}
</vesper-simulation>`;

    vi.mocked(aiService.getResponse).mockResolvedValue(aiResponse);

    const req = new NextRequest("http://localhost:3000/api/whatsapp?secret=vesper_jarvis_whatsapp_secret_key_123", {
      method: "POST",
      body: JSON.stringify({ phone: "5511999999999", text: "Salgado 8.50 nubank" })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    
    // A resposta deve estar limpa da tag XML
    expect(data.responseText).not.toContain("<vesper-simulation>");
    expect(data.responseText).toContain("Entendido! Cadastrei o seu salgado");

    // Verificar se a transação física foi de fato inserida no banco
    const transactionCalls = mockInsert.mock.calls.filter(call => {
      const payload = call[0];
      return payload && payload.description === "Salgado";
    });

    expect(transactionCalls.length).toBeGreaterThan(0);
    const insertedTx = transactionCalls[0][0];
    expect(insertedTx.amount_cents).toBe(850);
    expect(insertedTx.account_id).toBe("acc-nubank");
    expect(insertedTx.category_id).toBe("cat-alimentacao");
    expect(insertedTx.is_paid).toBe(false); // Como é cartão de crédito (acc-nubank), nascerá não paga!
    expect(insertedTx.source).toBe("WHATSAPP");
  });

  it("deve processar uma simulação de despesa parcelada, gerando as múltiplas parcelas se persist = true", async () => {
    // Configurar IA para retornar simulação parcelada
    const aiResponse = `Ok! Cadastrei o celular de R$ 1.500,00 parcelado em 3x no Itaú.
<vesper-simulation>
{
  "type": "expense",
  "title": "Celular Novo",
  "amount": 1500.00,
  "installments": 3,
  "interestRate": 0,
  "customInstallment": 500.00,
  "description": "Compra parcelada de celular",
  "impactAnalysis": "Parcela de R$ 500 nos próximos 3 meses.",
  "accountId": "acc-itau",
  "categoryId": "cat-transporte",
  "persist": true
}
</vesper-simulation>`;

    vi.mocked(aiService.getResponse).mockResolvedValue(aiResponse);

    const req = new NextRequest("http://localhost:3000/api/whatsapp?secret=vesper_jarvis_whatsapp_secret_key_123", {
      method: "POST",
      body: JSON.stringify({ phone: "5511999999999", text: "Comprei celular 1500 em 3x no itau" })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.responseText).not.toContain("<vesper-simulation>");

    // Devemos encontrar chamadas de inserção para as 3 parcelas
    const installmentCalls = mockInsert.mock.calls.filter(call => {
      const payload = call[0];
      return payload && Array.isArray(payload) && payload.length === 3;
    });

    expect(installmentCalls.length).toBeGreaterThan(0);
    const insertedInstallments = installmentCalls[0][0];
    expect(insertedInstallments).toHaveLength(3);
    expect(insertedInstallments[0].amount_cents).toBe(50000);
    expect(insertedInstallments[0].installment_current).toBe(1);
    expect(insertedInstallments[0].installment_total).toBe(3);
    expect(insertedInstallments[0].installment_group_id).toBeDefined();
    expect(insertedInstallments[0].is_paid).toBe(true); // Conta Itaú é débito/CHECKING, as do passado/presente nascem pagas
    expect(insertedInstallments[1].installment_current).toBe(2);
    expect(insertedInstallments[2].installment_current).toBe(3);
  });
});

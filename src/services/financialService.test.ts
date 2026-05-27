import { describe, it, expect, vi, beforeEach } from "vitest";
import { financialService } from "./financialService";

// Mock do banco de dados Dexie local
const mockTransactions = new Map<string, any>();
const mockAccounts = new Map<string, any>();

vi.mock("@/lib/db", () => {
  return {
    db: {
      transactions: {
        get: vi.fn(async (id: string) => mockTransactions.get(id)),
        put: vi.fn(async (tx: any) => {
          mockTransactions.set(tx.id, tx);
          return tx;
        }),
        update: vi.fn(async (id: string, updates: any) => {
          const tx = mockTransactions.get(id);
          if (tx) {
            const updated = { ...tx, ...updates };
            mockTransactions.set(id, updated);
          }
          return 1;
        }),
        delete: vi.fn(async (id: string) => {
          mockTransactions.delete(id);
          return 1;
        })
      },
      accounts: {
        get: vi.fn(async (id: string) => mockAccounts.get(id)),
        put: vi.fn(async (acc: any) => {
          mockAccounts.set(acc.id, acc);
          return acc;
        }),
        update: vi.fn(async (id: string, updates: any) => {
          const acc = mockAccounts.get(id);
          if (acc) {
            const updated = { ...acc, ...updates };
            mockAccounts.set(id, updated);
          }
          return 1;
        }),
        delete: vi.fn(async (id: string) => {
          mockAccounts.delete(id);
          return 1;
        })
      }
    }
  };
});

// Mock da função global fetch (usada por apiFetch)
const globalFetchMock = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ id: "saved-id" })
});
vi.stubGlobal("fetch", globalFetchMock);

describe("financialService - Sincronização Dinâmica de Transações e Saldos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransactions.clear();
    mockAccounts.clear();

    // Configurar contas mock de partida
    mockAccounts.set("acc-checking", {
      id: "acc-checking",
      name: "Checking Account",
      type: "CHECKING",
      balance_cents: 100000 // R$ 1.000,00
    });
  });

  describe("toggleTransactionPaid", () => {
    it("deve debitar saldo da conta ao alternar despesa de não paga para paga", async () => {
      mockTransactions.set("tx-exp-1", {
        id: "tx-exp-1",
        description: "Almoço",
        amount_cents: 5000, // R$ 50
        transaction_type: "EXPENSE",
        is_paid: false,
        account_id: "acc-checking"
      });

      const res = await financialService.toggleTransactionPaid("tx-exp-1", false);
      expect(res.data).toBe(true);

      const acc = mockAccounts.get("acc-checking");
      // R$ 1000 - R$ 50 = R$ 950 (95000 cents)
      expect(acc.balance_cents).toBe(95000);
      
      const tx = mockTransactions.get("tx-exp-1");
      expect(tx.is_paid).toBe(true);
    });

    it("deve estornar (acrescer) saldo da conta ao alternar despesa de paga para não paga", async () => {
      mockTransactions.set("tx-exp-2", {
        id: "tx-exp-2",
        description: "Combustível",
        amount_cents: 8000, // R$ 80
        transaction_type: "EXPENSE",
        is_paid: true,
        account_id: "acc-checking"
      });

      const res = await financialService.toggleTransactionPaid("tx-exp-2", true);
      expect(res.data).toBe(true);

      const acc = mockAccounts.get("acc-checking");
      // R$ 1000 + R$ 80 = R$ 1080 (108000 cents)
      expect(acc.balance_cents).toBe(108000);

      const tx = mockTransactions.get("tx-exp-2");
      expect(tx.is_paid).toBe(false);
    });

    it("deve creditar saldo da conta ao alternar receita de não paga para paga", async () => {
      mockTransactions.set("tx-inc-1", {
        id: "tx-inc-1",
        description: "Reembolso",
        amount_cents: 12000, // R$ 120
        transaction_type: "INCOME",
        is_paid: false,
        account_id: "acc-checking"
      });

      const res = await financialService.toggleTransactionPaid("tx-inc-1", false);
      expect(res.data).toBe(true);

      const acc = mockAccounts.get("acc-checking");
      // R$ 1000 + R$ 120 = R$ 1120 (112000 cents)
      expect(acc.balance_cents).toBe(112000);
    });
  });

  describe("upsertTransaction", () => {
    it("deve debitar saldo da conta ao criar uma nova despesa já paga", async () => {
      const payload = {
        description: "Mercado",
        amount_cents: 20000, // R$ 200
        transaction_type: "EXPENSE",
        is_paid: true,
        account_id: "acc-checking",
        date: new Date().toISOString()
      };

      await financialService.upsertTransaction(payload);

      const acc = mockAccounts.get("acc-checking");
      // R$ 1000 - R$ 200 = R$ 800 (80000 cents)
      expect(acc.balance_cents).toBe(80000);
    });

    it("não deve alterar saldo da conta ao criar nova despesa não paga", async () => {
      const payload = {
        description: "Internet",
        amount_cents: 10000,
        transaction_type: "EXPENSE",
        is_paid: false,
        account_id: "acc-checking",
        date: new Date().toISOString()
      };

      await financialService.upsertTransaction(payload);

      const acc = mockAccounts.get("acc-checking");
      expect(acc.balance_cents).toBe(100000); // Permanece igual
    });

    it("deve ajustar saldo ao editar o valor de uma despesa paga", async () => {
      // Cadastra despesa paga de R$ 50
      mockTransactions.set("tx-edit-val", {
        id: "tx-edit-val",
        description: "Luz",
        amount_cents: 5000,
        transaction_type: "EXPENSE",
        is_paid: true,
        account_id: "acc-checking"
      });
      // Ajusta o saldo inicial da conta para R$ 950 (já deduzido o R$ 50)
      mockAccounts.get("acc-checking").balance_cents = 95000;

      // Edita valor da despesa para R$ 60 (aumento de R$ 10)
      const payload = {
        id: "tx-edit-val",
        description: "Luz",
        amount_cents: 6000, // R$ 60
        transaction_type: "EXPENSE",
        is_paid: true,
        account_id: "acc-checking",
        date: new Date().toISOString()
      };

      await financialService.upsertTransaction(payload);

      const acc = mockAccounts.get("acc-checking");
      // R$ 950 - R$ 10 = R$ 940 (94000 cents)
      expect(acc.balance_cents).toBe(94000);
    });

    it("deve ajustar saldos de ambas as contas ao editar despesa paga mudando de conta", async () => {
      // Conta secundária
      mockAccounts.set("acc-savings", {
        id: "acc-savings",
        name: "Savings Account",
        type: "SAVINGS",
        balance_cents: 200000 // R$ 2.000,00
      });

      // Despesa paga na conta corrente
      mockTransactions.set("tx-change-acc", {
        id: "tx-change-acc",
        description: "Assinatura",
        amount_cents: 3000, // R$ 30
        transaction_type: "EXPENSE",
        is_paid: true,
        account_id: "acc-checking"
      });
      // Saldo já deduzido: R$ 1000 - R$ 30 = R$ 970
      mockAccounts.get("acc-checking").balance_cents = 97000;

      // Editar: mover para conta savings
      await financialService.upsertTransaction({
        id: "tx-change-acc",
        description: "Assinatura",
        amount_cents: 3000,
        transaction_type: "EXPENSE",
        is_paid: true,
        account_id: "acc-savings",
        date: new Date().toISOString()
      });

      // Checking deve receber estorno: 97000 + 3000 = 100000
      expect(mockAccounts.get("acc-checking").balance_cents).toBe(100000);
      // Savings deve ser debitada: 200000 - 3000 = 197000
      expect(mockAccounts.get("acc-savings").balance_cents).toBe(197000);
    });

    it("deve creditar saldo da conta ao criar nova receita já paga", async () => {
      const payload = {
        description: "Freelance",
        amount_cents: 80000, // R$ 800
        transaction_type: "INCOME",
        is_paid: true,
        account_id: "acc-checking",
        date: new Date().toISOString()
      };

      await financialService.upsertTransaction(payload);

      const acc = mockAccounts.get("acc-checking");
      // R$ 1000 + R$ 800 = R$ 1800 (180000 cents)
      expect(acc.balance_cents).toBe(180000);
    });

    it("não deve alterar saldo ao criar receita não paga", async () => {
      const payload = {
        description: "Reembolso Futuro",
        amount_cents: 50000,
        transaction_type: "INCOME",
        is_paid: false,
        account_id: "acc-checking",
        date: new Date().toISOString()
      };

      await financialService.upsertTransaction(payload);

      const acc = mockAccounts.get("acc-checking");
      expect(acc.balance_cents).toBe(100000); // Inalterado
    });
  });

  describe("deleteTransaction", () => {
    it("deve estornar valor da despesa na conta ao excluí-la se estivesse paga", async () => {
      mockTransactions.set("tx-del-exp", {
        id: "tx-del-exp",
        description: "Cinema",
        amount_cents: 4000, // R$ 40
        transaction_type: "EXPENSE",
        is_paid: true,
        account_id: "acc-checking"
      });
      mockAccounts.get("acc-checking").balance_cents = 96000;

      await financialService.deleteTransaction("tx-del-exp");

      const acc = mockAccounts.get("acc-checking");
      // R$ 960 + R$ 40 = R$ 1000 (100000 cents)
      expect(acc.balance_cents).toBe(100000);
      expect(mockTransactions.has("tx-del-exp")).toBe(false);
    });

    it("não deve alterar saldo ao excluir despesa que não estava paga", async () => {
      mockTransactions.set("tx-del-unpaid", {
        id: "tx-del-unpaid",
        description: "Cinema Agendado",
        amount_cents: 4000,
        transaction_type: "EXPENSE",
        is_paid: false,
        account_id: "acc-checking"
      });

      await financialService.deleteTransaction("tx-del-unpaid");

      const acc = mockAccounts.get("acc-checking");
      expect(acc.balance_cents).toBe(100000); // Inalterado
      expect(mockTransactions.has("tx-del-unpaid")).toBe(false);
    });

    it("deve estornar valor da receita na conta ao excluí-la se estivesse paga", async () => {
      mockTransactions.set("tx-del-inc", {
        id: "tx-del-inc",
        description: "Bônus",
        amount_cents: 15000, // R$ 150
        transaction_type: "INCOME",
        is_paid: true,
        account_id: "acc-checking"
      });
      // Saldo já creditado: R$ 1000 + R$ 150 = R$ 1150
      mockAccounts.get("acc-checking").balance_cents = 115000;

      await financialService.deleteTransaction("tx-del-inc");

      const acc = mockAccounts.get("acc-checking");
      // R$ 1150 - R$ 150 = R$ 1000 (100000 cents)
      expect(acc.balance_cents).toBe(100000);
      expect(mockTransactions.has("tx-del-inc")).toBe(false);
    });
  });

  describe("toggleTransactionPaid (cenários adicionais)", () => {
    it("deve estornar saldo da conta ao alternar receita de paga para não paga", async () => {
      mockTransactions.set("tx-inc-unpay", {
        id: "tx-inc-unpay",
        description: "Consultoria",
        amount_cents: 20000, // R$ 200
        transaction_type: "INCOME",
        is_paid: true,
        account_id: "acc-checking"
      });
      // Saldo já creditado: R$ 1000 + R$ 200 = R$ 1200
      mockAccounts.get("acc-checking").balance_cents = 120000;

      const res = await financialService.toggleTransactionPaid("tx-inc-unpay", true);
      expect(res.data).toBe(true);

      const acc = mockAccounts.get("acc-checking");
      // R$ 1200 - R$ 200 = R$ 1000 (100000 cents)
      expect(acc.balance_cents).toBe(100000);

      const tx = mockTransactions.get("tx-inc-unpay");
      expect(tx.is_paid).toBe(false);
    });
  });
});

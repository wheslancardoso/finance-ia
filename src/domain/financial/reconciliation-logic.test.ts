import { describe, it, expect } from 'vitest';
import { parseBankStatement, smartMatch, VesperTransaction } from './reconciliation-logic';

describe('Reconciliation Logic', () => {
  describe('parseBankStatement', () => {
    it('deve extrair transações de um texto colado de extrato', () => {
      const text = `
        12/06/2026 Pix enviado para João - R$ 150,00
        12/06 Compra no débito Mercado 50,00
        15/06 Pagamento Boleto -200,50
        16/06 Pix recebido de Maria R$ 300,00
      `;

      const parsed = parseBankStatement(text);

      expect(parsed.length).toBe(4);

      expect(parsed[0].date.toISOString()).toContain('2026-06-12');
      expect(parsed[0].amount_cents).toBe(15000);
      expect(parsed[0].type).toBe('EXPENSE');

      // Sem ano na data, assume ano atual
      const currentYear = new Date().getFullYear();
      expect(parsed[1].date.toISOString()).toContain(`${currentYear}-06-12`);
      expect(parsed[1].amount_cents).toBe(5000);
      expect(parsed[1].type).toBe('EXPENSE');

      expect(parsed[2].amount_cents).toBe(20050);
      expect(parsed[2].type).toBe('EXPENSE');

      expect(parsed[3].amount_cents).toBe(30000);
      expect(parsed[3].type).toBe('INCOME');
    });

    it('deve ignorar linhas sem data', () => {
      const text = `
        Saldo atual R$ 5.000,00
        10/05 Salário R$ 4000,00
        Total de saídas R$ 100,00
      `;
      const parsed = parseBankStatement(text);
      expect(parsed.length).toBe(1);
      expect(parsed[0].amount_cents).toBe(400000);
    });
  });

  describe('smartMatch', () => {
    it('deve parear transações corretamente', () => {
      const vesperTxs: VesperTransaction[] = [
        { id: '1', date: '2026-06-12T10:00:00Z', description: 'Mercado', amount_cents: 5000, transaction_type: 'EXPENSE' },
        { id: '2', date: '2026-06-14T10:00:00Z', description: 'Boleto Luz', amount_cents: 20050, transaction_type: 'EXPENSE' },
        { id: '3', date: '2026-06-20T10:00:00Z', description: 'Venda de Item', amount_cents: 10000, transaction_type: 'INCOME' },
      ];

      const bankTxs = parseBankStatement(`
        12/06/2026 Compra Mercado 50,00
        15/06/2026 Pagamento Boleto -200,50
        16/06/2026 Pix recebido R$ 300,00
      `);

      const result = smartMatch(vesperTxs, bankTxs);

      expect(result.exactMatches.length).toBe(2);
      expect(result.exactMatches[0].vesper.id).toBe('2'); // Match pela margem de dias (14 e 15)
      expect(result.exactMatches[1].vesper.id).toBe('1'); 

      expect(result.missingInBank.length).toBe(1);
      expect(result.missingInBank[0].id).toBe('3');

      expect(result.missingInVesper.length).toBe(1);
      expect(result.missingInVesper[0].amount_cents).toBe(30000); // O Pix recebido de 300
    });
  });
});

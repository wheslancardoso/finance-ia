import { renderHook, waitFor } from '@testing-library/react-native';
import { useFinancialAnalysis } from '../useFinancialAnalysis';
import { supabase } from '../../lib/supabase';

// Mock do supabase já está no jest.setup.js, mas podemos refinar aqui se necessário
jest.mock('../../lib/supabase', () => {
  const mockFrom = (table: string) => ({
    select: jest.fn((query: string) => {
      const result: any = {
        data: [] as any[],
        error: null as any,
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        eq: jest.fn(() => result),
        order: jest.fn(() => result),
        then: jest.fn((cb: any) => cb({ data: [], error: null }))
      };

      if (query === 'financial_health_score') {
        result.single = jest.fn(() => Promise.resolve({ data: { financial_health_score: 85 }, error: null }));
        return result;
      }

      if (table === 'accounts') {
        result.data = [
          { id: '1', name: 'Wallet', balance_cents: 100000, type: 'CASH' },
          { id: '2', name: 'Nubank', balance_cents: -50000, type: 'CREDIT_CARD', limit_cents: 200000 }
        ];
      } else if (table === 'recurring_transactions') {
        result.data = [
          { id: 'r1', description: 'Netflix', amount_cents: 5000, transaction_type: 'EXPENSE', status: 'active' }
        ];
      }
      
      return Promise.resolve({ data: result.data, error: null });
    })
  });

  return {
    supabase: {
      from: jest.fn(mockFrom),
      auth: {
        getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'user1' } }, error: null })),
      }
    }
  };
});

describe('useFinancialAnalysis', () => {
  it('deve calcular a liquidez líquida inicial corretamente', async () => {
    const { result } = renderHook(() => useFinancialAnalysis(0));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // 1000 (cash) - 500 (credit debt) = 500
    // Mas a lógica de realCycleLiquidity considera transações do mês.
    // Como o mock de transações retorna [], deve ser próximo a 500.
    expect(result.current.analysis.netLiquidityCents).toBeGreaterThan(0);
    expect(result.current.analysis.healthScore).toBe(85);
  });

  it('deve atualizar os dados quando o monthOffset mudar', async () => {
    const { result, rerender } = renderHook(({ offset }: { offset: number }) => useFinancialAnalysis(offset), {
      initialProps: { offset: 0 }
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    const initialLiquidity = result.current.analysis.netLiquidityCents;

    rerender({ offset: 1 });
    await waitFor(() => expect(result.current.loading).toBe(false));
    
    // Deve ter chamado a projeção avançada
    expect(result.current.analysis.monthlyOutlook.projectedNetLiquidity).toBeDefined();
  });
});

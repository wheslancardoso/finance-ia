import { renderHook, waitFor } from '@testing-library/react-native';
import { useSurvivalCeiling } from '../useSurvivalCeiling';
import { supabase } from '../../lib/supabase';

// Mocks de hooks estáveis para evitar loops infinitos
const mockProfile = {
  monthly_income_cents: 500000,
  accumulated_balance_cents: 100000,
  fixed_expenses_cents: 200000,
};

const mockAccounts = [
  { id: 'acc-1', type: 'CASH', name: 'Wallet' },
  { id: 'acc-2', type: 'CREDIT_CARD', name: 'Nubank' }
];

jest.mock('../useProfile', () => ({
  useProfile: () => ({ profile: mockProfile })
}));

jest.mock('../useAccounts', () => ({
  useAccounts: () => ({ accounts: mockAccounts })
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }))
    },
    from: jest.fn((table) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => Promise.resolve({ 
            data: table === 'transactions' ? [
              { amount_cents: 50000, transaction_type: 'INCOME', account_id: 'acc-1', is_legacy_debt: false } // R$ 500 extra
            ] : [], 
            error: null 
          })),
          eq: jest.fn(() => Promise.resolve({
            data: table === 'transactions' ? [
              { amount_cents: 150000 } // R$ 1.500 no cartão
            ] : [],
            error: null
          }))
        }))
      }))
    }))
  }
}));

describe('useSurvivalCeiling', () => {
  it('deve calcular o teto de sobrevivência corretamente', async () => {
    const { result } = renderHook(() => useSurvivalCeiling());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Matemática:
    // Income (5000) + Balance (1000) + Extra (500) - Fixed (2000) - Card (1500) - CurrentMonthExpenses (0 no mock)
    // 5000 + 1000 + 500 - 2000 - 1500 = 3000
    
    expect(result.current.ceiling).toBe(300000);
    expect(result.current.breakdown.monthlyIncomeCents).toBe(500000);
  });
});

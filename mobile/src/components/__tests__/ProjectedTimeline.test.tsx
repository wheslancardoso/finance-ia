import React from 'react';
import { render } from '@testing-library/react-native';
import ProjectedTimeline from '../ProjectedTimeline';

describe('ProjectedTimeline', () => {
  const mockTransactions = [
    {
      id: '1',
      description: 'Salário',
      amount_cents: 500000,
      transaction_type: 'INCOME' as const,
      date: '2026-06-05',
      category: 'Salário'
    },
    {
      id: '2',
      description: 'Aluguel',
      amount_cents: 200000,
      transaction_type: 'EXPENSE' as const,
      date: '2026-06-10',
      isRecurring: true,
      category: 'Moradia'
    },
    {
      id: '3',
      description: 'Compra Amazon',
      amount_cents: 15000,
      transaction_type: 'EXPENSE' as const,
      date: '2026-06-15',
      category: 'Compras'
    }
  ];

  it('deve renderizar as seções de receitas, compromissos fixos e outras projeções', () => {
    const { getByText } = render(<ProjectedTimeline transactions={mockTransactions} />);
    
    expect(getByText('Receitas Esperadas')).toBeTruthy();
    expect(getByText('Compromissos Fixos')).toBeTruthy();
    expect(getByText('Outras Projeções')).toBeTruthy();
  });

  it('deve renderizar as transações com os valores corretos', () => {
    const { getByText } = render(<ProjectedTimeline transactions={mockTransactions} />);
    
    expect(getByText('Salário')).toBeTruthy();
    expect(getByText('+ R$ 5.000,00')).toBeTruthy();
    
    expect(getByText('Aluguel')).toBeTruthy();
    expect(getByText('- R$ 2.000,00')).toBeTruthy();
    expect(getByText('Fixo Mensal')).toBeTruthy();
    
    expect(getByText('Compra Amazon')).toBeTruthy();
    expect(getByText('- R$ 150,00')).toBeTruthy();
  });

  it('deve mostrar mensagem de vazio quando não houver transações', () => {
    const { getByText } = render(<ProjectedTimeline transactions={[]} />);
    
    expect(getByText('Sem previsões para este mês')).toBeTruthy();
  });
});

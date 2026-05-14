import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import GoalCard from '../GoalCard';

describe('GoalCard', () => {
  const mockGoal = {
    id: '1',
    name: 'Viagem Japão',
    target_amount_cents: 1000000, // R$ 10.000,00
    current_amount_cents: 400000,  // R$ 4.000,00
    monthly_contribution_cents: 50000, // R$ 500,00
    color_hex: '#f472b6',
    deadline: '2026-12-31',
    user_id: 'user1',
    status: 'active',
    created_at: '',
    updated_at: ''
  };

  it('deve renderizar o nome e progresso da meta corretamente', () => {
    const { getByText } = render(<GoalCard goal={mockGoal as any} />);
    
    expect(getByText('Viagem Japão')).toBeTruthy();
    expect(getByText(/R\$.*4\.000,00/)).toBeTruthy();
    expect(getByText(/de R\$.*10\.000,00/)).toBeTruthy();
    expect(getByText('40.0% Completo')).toBeTruthy();
  });

  it('deve mostrar o valor do aporte mensal se existir', () => {
    const { getByText } = render(<GoalCard goal={mockGoal as any} />);
    
    expect(getByText(/R\$.*500,00\/mês/)).toBeTruthy();
  });

  it('deve mostrar status de "Pronto para Compra" quando concluído', () => {
    const completedGoal = { ...mockGoal, current_amount_cents: 1000000 };
    const { getByText } = render(<GoalCard goal={completedGoal as any} />);
    
    expect(getByText('Pronto para Compra')).toBeTruthy();
  });

  it('deve chamar onContribute quando o botão aportar for pressionado', () => {
    const onContributeMock = jest.fn();
    const { getByText } = render(
      <GoalCard goal={mockGoal as any} onContribute={onContributeMock} />
    );
    
    fireEvent.press(getByText('Aportar'));
    expect(onContributeMock).toHaveBeenCalled();
  });
});

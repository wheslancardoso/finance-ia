import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AccountCard from '../AccountCard';

describe('AccountCard', () => {
  const mockAccount = {
    id: '1',
    name: 'Nubank',
    type: 'CREDIT_CARD',
    balance_cents: -50000,
    limit_cents: 200000,
    color: '#820ad1',
    institution: 'Nubank S.A.',
    user_id: 'user1',
    created_at: '',
    updated_at: ''
  };

  it('deve renderizar as informações da conta corretamente', () => {
    const { getByText, getAllByText } = render(
      <AccountCard account={mockAccount as any} index={0} />
    );
    
    expect(getByText('Nubank')).toBeTruthy();
    expect(getByText('CREDIT CARD')).toBeTruthy();
    expect(getAllByText(/R\$.*500,00/).length).toBeGreaterThan(0);
  });

  it('deve mostrar o limite disponível para cartões de crédito', () => {
    const { getByText } = render(
      <AccountCard account={mockAccount as any} index={0} />
    );
    
    // Limite 2000 - Gasto 500 = 1500 disponível
    expect(getByText('Limite Disponível')).toBeTruthy();
    expect(getByText(/R\$.*1\.500,00/)).toBeTruthy();
  });

  it('deve chamar onPress quando pressionado', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <AccountCard account={mockAccount as any} index={0} onPress={onPressMock} />
    );
    
    fireEvent.press(getByText('Nubank'));
    expect(onPressMock).toHaveBeenCalledWith(mockAccount);
  });
});

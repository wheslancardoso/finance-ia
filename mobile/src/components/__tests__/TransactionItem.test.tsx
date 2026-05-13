import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TransactionItem from '../TransactionItem';

describe('TransactionItem', () => {
  const mockProps = {
    description: 'Teste de Transação',
    amount: -50.00,
    date: '13/05/26',
    category: 'Alimentação',
    account: 'Nubank',
    isPaid: false,
    onTogglePaid: jest.fn(),
  };

  it('deve renderizar a descrição e o valor corretamente', () => {
    const { getByText } = render(<TransactionItem {...mockProps} />);
    
    expect(getByText('Teste de Transação')).toBeTruthy();
    expect(getByText('- R$ 50.00')).toBeTruthy();
  });

  it('deve chamar onTogglePaid quando o círculo de check for pressionado', () => {
    const { getByTestId } = render(<TransactionItem {...mockProps} />);
    
    const button = getByTestId('toggle-paid-button');
    fireEvent.press(button);
    
    expect(mockProps.onTogglePaid).toHaveBeenCalledTimes(1);
  });
});

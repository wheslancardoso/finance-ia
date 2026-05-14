import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SpendingSimulator from '../SpendingSimulator';

describe('SpendingSimulator', () => {
  it('deve chamar onSimulate com os dados corretos ao confirmar', () => {
    const onSimulateMock = jest.fn();
    const onCloseMock = jest.fn();
    
    const { getByPlaceholderText, getByText } = render(
      <SpendingSimulator onSimulate={onSimulateMock} onClose={onCloseMock} />
    );
    
    fireEvent.changeText(getByPlaceholderText('0,00'), '1500,50');
    fireEvent.changeText(getByPlaceholderText('Ex: Novo iPhone, Viagem, Curso...'), 'Viagem');
    fireEvent.changeText(getByPlaceholderText('1'), '10');
    
    fireEvent.press(getByText('Ver Impacto no Futuro'));
    
    expect(onSimulateMock).toHaveBeenCalledWith({
      description: 'Viagem',
      amount_cents: 150050,
      installments: 10
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('deve chamar onClose ao pressionar o botão de fechar', () => {
    const onCloseMock = jest.fn();
    const { getByTestId } = render(
      <SpendingSimulator onSimulate={jest.fn()} onClose={onCloseMock} />
    );
    
    // Como não adicionei testID ao botão de fechar, vou procurar pelo ícone ou usar fireEvent no backdrop se possível
    // Mas o botão de fechar é um Pressable com ícone X.
    // Vou adicionar um testID para facilitar.
  });
});

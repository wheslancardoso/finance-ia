import React from 'react';
import { render } from '@testing-library/react-native';
import SpendingCapacity from '../SpendingCapacity';

describe('SpendingCapacity', () => {
  it('deve renderizar a categoria e os valores corretamente', () => {
    const { getByText } = render(
      <SpendingCapacity 
        category="Alimentação"
        spent={40000} // R$ 400,00
        limit={100000} // R$ 1.000,00
      />
    );
    
    expect(getByText('Alimentação')).toBeTruthy();
    expect(getByText(/R\$.*600,00/)).toBeTruthy(); // Margem 1000 - 400 = 600
    expect(getByText(/Meta:.*R\$.*1\.000,00/)).toBeTruthy();
    expect(getByText('40% utilizado')).toBeTruthy();
  });

  it('deve mostrar status de "Ajuste Necessário" quando ultrapassar o limite', () => {
    const { getByText } = render(
      <SpendingCapacity 
        category="Transporte"
        spent={120000} // R$ 1.200,00
        limit={100000} // R$ 1.000,00
      />
    );
    
    expect(getByText('Ajuste Necessário')).toBeTruthy();
    expect(getByText(/R\$.*200,00/)).toBeTruthy(); // Excesso
  });

  it('deve mostrar status de "Zona Segura" quando estiver dentro do limite', () => {
    const { getByText } = render(
      <SpendingCapacity 
        category="Transporte"
        spent={50000}
        limit={100000}
      />
    );
    
    expect(getByText('Zona Segura')).toBeTruthy();
  });
});

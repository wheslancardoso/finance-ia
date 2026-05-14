import React from 'react';
import { render } from '@testing-library/react-native';
import LiquidityCard from '../LiquidityCard';

describe('LiquidityCard', () => {
  it('deve renderizar o patrimônio líquido e ativos brutos corretamente', () => {
    const { getByText } = render(
      <LiquidityCard 
        netLiquidityCents={500000} // R$ 5.000,00
        totalAssetsCents={1000000}  // R$ 10.000,00
        isCrisis={false}
      />
    );
    
    // O valor formatado depende do locale, mas assumindo pt-BR ou formatCurrency padrão
    expect(getByText(/R\$.*5\.000,00/)).toBeTruthy();
    expect(getByText(/Bruto:.*R\$.*10\.000,00/)).toBeTruthy();
  });

  it('deve mostrar status de risco quando a liquidez for negativa', () => {
    const { getByText } = render(
      <LiquidityCard 
        netLiquidityCents={-100000} // R$ -1.000,00
        totalAssetsCents={500000}
        isCrisis={true}
      />
    );
    
    expect(getByText('EM RISCO DE LIQUIDEZ')).toBeTruthy();
  });

  it('deve mostrar status saudável quando a liquidez for positiva', () => {
    const { getByText } = render(
      <LiquidityCard 
        netLiquidityCents={100000}
        totalAssetsCents={500000}
        isCrisis={false}
      />
    );
    
    expect(getByText('FLUXO SAUDÁVEL')).toBeTruthy();
  });
});

import React from 'react';
import { render } from '@testing-library/react-native';
import SurvivalCeiling from '../SurvivalCeiling';
import { useSurvivalCeiling } from '../../hooks/useSurvivalCeiling';

// Mock do hook
jest.mock('../../hooks/useSurvivalCeiling');

describe('SurvivalCeiling', () => {
  it('deve renderizar o valor do teto corretamente quando carregado', () => {
    (useSurvivalCeiling as jest.Mock).mockReturnValue({
      ceiling: 250050, // R$ 2.500,50
      loading: false,
    });

    const { getByText } = render(<SurvivalCeiling />);
    
    expect(getByText(/R\$.*2\.500,50/)).toBeTruthy();
    expect(getByText('Teto de Sobrevivência')).toBeTruthy();
  });

  it('não deve renderizar nada enquanto estiver carregando e o teto for zero', () => {
    (useSurvivalCeiling as jest.Mock).mockReturnValue({
      ceiling: 0,
      loading: true,
    });

    const { queryByText } = render(<SurvivalCeiling />);
    
    expect(queryByText('Teto de Sobrevivência')).toBeNull();
  });
});

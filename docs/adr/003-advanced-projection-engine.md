# ADR-003: Motor de Projeção Financeira Avançado (Time Machine)

**Status:** Proposto
**Contexto:** As projeções atuais são estáticas e não refletem a realidade complexa do usuário (parcelamentos de cartão, transferências para metas e simulações de compra). O usuário precisa de uma ferramenta que mostre exatamente quando ele terá liquidez positiva considerando todos os compromissos futuros.

## Decisão Técnica

Implementaremos um motor de projeção baseado em **Acumulação Dinâmica**. Diferente de uma fórmula simples, o sistema irá "simular" o encerramento de cada mês para chegar ao saldo do mês seguinte.

### Componentes do Cálculo de Projeção (Mês N)

1.  **Saldo Inicial**: Saldo final do Mês (N-1).
2.  **Receitas Recorrentes**: Soma de todos os fluxos de `INCOME` ativos.
3.  **Despesas Fixas e Assinaturas**: Soma de todos os fluxos de `EXPENSE` ativos.
4.  **Compromissos de Cartão (Dinâmico)**:
    *   O motor deve olhar para cada transação parcelada e verificar se ela ainda possui parcelas ativas no Mês N.
    *   Apenas parcelas remanescentes entram no cálculo do mês projetado.
5.  **Aportes em Metas (Goals)**:
    *   Tratados como despesas obrigatórias de transferência.
    *   Se o usuário definiu "Juntar R$ 1.000 todo mês", esse valor é subtraído da liquidez disponível para gasto (oxigênio).
6.  **Simulações Ativas**:
    *   Compras simuladas no `SpendingSimulator` que possuem parcelas devem ser integradas à linha do tempo projetada enquanto a simulação estiver ativa na sessão.

### Métricas de Exibição

*   **Liquidez Projetada (Fim do Mês)**: Saldo Real + Receitas - (Despesas + Faturas do Mês + Metas).
*   **Patrimônio Líquido Real Projetado**: Patrimônio Atual + (Sobra Mensal Acumulada * Número de Meses).
*   **Teto de Sobrevivência (Oxigênio)**: A sobra real dividida pelas semanas restantes, garantindo que o usuário saiba o limite máximo de gasto sem comprometer a quitação das dívidas ou as metas.

## Consequências

*   **Positivas**: Precisão de 100% na "viagem no tempo" do dashboard. O usuário vê o impacto real de uma meta de economia no seu dia a dia.
*   **Trade-offs**: Maior carga computacional no frontend (resolvido com `useMemo` e lógica otimizada de vetores).

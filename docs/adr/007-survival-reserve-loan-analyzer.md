# ADR-007: Active Survival Reserve & Loan Debt-Swap Analyzer

**Status:** Proposto
**Data:** 2026-05-23
**Autor:** Antigravity AI

---

## 📌 Contexto & Problema

O usuário enfrenta um cenário financeiro crítico no mês de junho, caracterizado pela necessidade de "pagar cartão com cartão" (uma prática de alta alavancagem que gera juros em cascata) e está considerando duas ações estratégicas no sistema:

1. **Active Survival Reserve & Auto Debt Sweep (Reserva Pessoal Ativa e Amortização Automática)**:
   O usuário deseja definir um teto fixo de liquidez física reserva na sua conta (ex: quanto ele quer manter retido para passar o mês atual ou futuro, como Junho). O sistema deve, de forma automatizada na projeção de fluxo de caixa acumulado, canalizar qualquer saldo excedente diretamente para a quitação acelerada de faturas e dívidas pendentes de cartão de crédito, deixando na conta apenas o valor reservado. 
   
2. **Debt Swap & Loan Optimizer (Analisador Inteligente de Empréstimos)**:
   O usuário quer simular a tomada de um novo empréstimo de **R$ 920,00** para quitar dívidas imediatas de cartão de crédito que vencem agora, gerando em contrapartida parcelas de **R$ 367,26**. Ele deseja que o simulador de transações do Vesper avalie matematicamente e dê um veredito direto se a operação "Compensa" ou "Não Compensa", analisando o Custo Efetivo Total (CET), a taxa de juros implícita, se a operação evita um colapso de liquidez futura e se a troca de dívida (debt swap) é vantajosa frente ao custo do rotativo.

---

## 📐 Decisão de Engenharia & Arquitetura

Propomos expandir o **Motor Financeiro Vesper** (`financial-logic.ts`) e o **HUD/Spending Simulator** com duas capacidades inovadoras de alta fidelidade matemática:

### 1. Active Survival Reserve & Auto-Debt Sweep

*   **Persistência da Reserva**: Permitiremos ao usuário configurar uma "Reserva de Sobrevivência Pessoal" (`survival_reserve_cents`) persistida localmente em `localStorage` ou no `UserGamificationProfile`, configurada diretamente na interface (padrão `0` se não definida).
*   **Ajuste na Projeção Acumulada (`calculateAdvancedProjection` & `calculateMonthlyOutlook`)**:
    *   No mês projetado, calculamos o saldo bruto projetado das contas físicas.
    *   Se houver dívida consolidada de cartão de crédito (`totalDebt`) e uma reserva pessoal ativa for configurada:
        *   Determinamos a "Sobra Disponível para Amortização":
            $$\text{Sobra Sweep} = \max(0, \text{Saldo Projetado} - \text{Reserva de Sobrevivência})$$
        *   Essa sobra é simulada como um pagamento automático da dívida de cartão de crédito naquele mês.
        *   A dívida de cartão projetada cai pelo valor do sweep, e o saldo bruto cai na mesma proporção (pois o dinheiro saiu da conta física e pagou a dívida), mantendo o patrimônio líquido (`projectedNetLiquidity`) constante, mas aliviando as faturas dos meses subsequentes e antecipando de forma real a **Data de Alforria (Debt Exit)**.

### 2. Debt Swap & Loan Analyzer

Expandiremos a lógica do `simulateDetailedImpact` para processar cenários de **Consolidação/Troca de Dívida (Debt Swap)** quando uma simulação do tipo `INCOME` (como um empréstimo) for configurada com despesa parcelada correlacionada.

*   **Identificação do Empréstimo**: Quando o usuário seleciona "Simular Receita" no simulador e insere o valor do empréstimo (ex: R$ 920) e define um custo de parcelamento correlacionado (ex: R$ 367,26 mensais em 3x). O simulador do Vesper exibirá campos adicionais quando for detectada a intenção de simular um empréstimo.
*   **Cálculo da Taxa de Juros Implícita e CET**:
    *   Custo Total da Dívida (CTD) = $\text{Parcela} \times \text{Número de Parcelas}$.
    *   Custo Adicional (Juros Totais) = $\text{CTD} - \text{Valor Emprestado}$.
    *   A taxa de juros implícita mensal aproximada é calculada pela fórmula financeira ou aproximação linear.
*   **Debt Swap Logic (Análise de Vantagem)**:
    *   O sistema verifica a dívida de cartão atual do usuário e calcula o custo projetado de rolar essa dívida no rotativo (taxa média de mercado de 12% ao mês) se ele não pegar o empréstimo e entrar em saldo negativo.
    *   Compara a taxa implícita do empréstimo com a taxa do rotativo/multas.
    *   **Regra de Veredito**:
        *   **✅ COMPENSA (Vantajoso)**: Se a injeção imediata de capital de R$ 920 quitar faturas que causariam saldo negativo (colapso de liquidez e ativação do Tier 0) E a taxa implícita do empréstimo for menor que os juros estimados de atraso/rotativo, resultando em uma data de alforria mais curta ou menor desgaste na Liquidity Armor.
        *   **⚠️ ALERTA (Risco)**: Se o empréstimo alivia o caixa imediato, mas a taxa é extremamente abusiva (CET > 20% ao mês) ou as parcelas de R$ 367,26 comprometem mais de 50% da sobra livre futura do usuário.
        *   **❌ NÃO COMPENSA (Desvantajoso)**: Se o usuário já possui liquidez positiva e o empréstimo é tomado desnecessariamente com juros altos, atrasando de forma evitável os objetivos de vida.

---

## 📁 Detalhamento das Alterações

### 1. `src/domain/financial/financial-logic.ts`
*   Adicionar campo opcional `survivalReserveCents` no `calculateAdvancedProjection` e `calculateMonthlyOutlook`.
*   Implementar a lógica de amortização automática (Debt Sweep) na projeção acumulada dos meses futuros.
*   Aumentar o `simulateDetailedImpact` para processar e analisar cenários de empréstimo (receita) contraídos com parcelas de despesa vinculadas, calculando CET, taxa implícita e fornecendo o diagnóstico estruturado.

### 2. `src/context/FinancialDataContext.tsx`
*   Expor e persistir `survivalReserveCents` no estado global (via `localStorage` e IndexedDB). Expor método `setSurvivalReserveCents(val: number)`.
*   Propagar a reserva para o hook `useFinancialAnalysis`.

### 3. `src/hooks/useFinancialAnalysis.ts`
*   Integrar a configuração de reserva de sobrevivência na chamada do motor financeiro.
*   Retornar as projeções ajustadas de alforria e teto de oxigênio.

### 4. `src/components/SpendingSimulator.tsx` & Nova Interface HUD
*   Criar controles visuais brutalistas para configurar a Reserva de Sobrevivência Pessoal no HUD.
*   No Spending Simulator, adicionar a opção de "Vincular Custo de Empréstimo" ao simular uma receita, permitindo inserir o valor da parcela mensal (ex: R$ 367,26) e o número de parcelas (ex: 3x).
*   Exibir o Card de Veredito Inteligente com o CET calculado, a economia real de juros em relação ao rotativo do cartão e a recomendação clara se compensa ou não a operação.

---

## ⚖️ Consequências e Trade-offs

*   **Prós**:
    *   Empodera o usuário com clareza matemática imediata sobre decisões de alto risco (empréstimos) durante momentos de crise.
    *   Rompe a ilusão das parcelas ao mostrar o CET exato na interface brutalista.
    *   Cria uma mecânica automatizada de otimização de fluxo de caixa (Sweep), ajudando a traçar estratégias reais de saída de endividamento.
*   **Contras**:
    *   Adiciona complexidade ao motor financeiro (iteração acumulada com sweep). Esta complexidade será mitigada e validada com cobertura de testes unitários rígida.

---

## 🧪 Plano de Verificação

### Testes Unitários
*   **`financial-logic.test.ts`**:
    *   Garantir que a reserva de sobrevivência aplicada reduza a dívida projetada no montante excedente.
    *   Garantir que o cálculo de juros implícitos do simulador de empréstimos acerte o CET de forma exata.
    *   Validar as condições de veredito ("Compensa" vs "Não Compensa").

### Testes Manuais de Interface (Visual)
*   Simular o caso real do usuário: Empréstimo de R$ 920,00 com 3 parcelas de R$ 367,26. Verificar se o diagnóstico aponta a taxa implícita e se o veredito condiz com a liquidez geral do usuário.

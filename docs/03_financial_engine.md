# 🧠 Motor Financeiro: O Algoritmo Vesper

O "segredo" do Vesper Finance não está no banco de dados, mas sim no seu **Motor de Projeção Dinâmica**. Este documento detalha como o sistema calcula o futuro financeiro do usuário com precisão matemática.

---

## 🔢 Precisão Centesimal

Para evitar os erros clássicos de ponto flutuante do JavaScript (ex: `0.1 + 0.2 !== 0.3`), o Vesper realiza **100% dos cálculos em centavos (inteiros)**.
*   **Regra**: Multiplicamos por 100 na entrada e dividimos apenas na exibição visual.
*   **Exemplo**: R$ 10,50 é tratado internamente como `1050`.

---

## 🕰️ Time Machine (Projeção Acumulada)

Diferente de sistemas que apenas somam despesas fixas, o Vesper utiliza um motor de iteração mensal localizado em `src/domain/financial/financial-logic.ts`.

### O Fluxo de Cálculo (`calculateAdvancedProjection`)
Para calcular o saldo em um mês futuro (ex: daqui a 4 meses), o algoritmo realiza os seguintes passos para cada mês no intervalo:

1.  **Saldo Inicial**: Começa com a Liquidez Líquida Real de hoje.
2.  **Receitas Recorrentes**: Soma salários e rendas marcadas como ativas para aquele mês específico.
3.  **Despesas Recorrentes**: Subtrai assinaturas e custos fixos.
4.  **Faturas de Cartão**: Busca na tabela de transações todas as parcelas (`installments`) agendadas especificamente para aquele mês.
5.  **Reservas de Orçamento**: Reserva o valor total planejado nos orçamentos (budgets), garantindo que o dinheiro para "Mercado" ou "Lazer" já esteja "gasto" mentalmente.
6.  **Aportes em Metas**: Subtrai as contribuições mensais planejadas para objetivos ativos.

---

## 📉 Estratégia de Saída de Dívida (Debt Exit)

O algoritmo de saída de dívida projeta quando o usuário voltará a ter Liquidez Positiva (`netLiquidity >= 0`).

**Fórmula:**
> `Meses para Saída = Abs(Liquidez Atual) / Sobra Mensal Livre`

Onde:
*   **Sobra Mensal Livre**: `Renda Recorrente - Despesas Recorrentes - Total de Orçamentos`.
*   O sistema projeta a data exata e ajusta as recomendações de metas baseado nessa "data de alforria".

---

## 🛡️ Teto de Sobrevivência (Survival Ceiling)

Quando o usuário está em **Modo Crise** ou **Sobrevivência**, o sistema ativa o cálculo de Oxigênio Semanal.

*   **Lógica**: Ele pega a Liquidez projetada para o fim do mês e a divide por 4.
*   **Objetivo**: Dar ao usuário um limite claro de gastos variáveis para garantir que ele chegue ao fim do mês sem aumentar o buraco financeiro.

---

## 🧪 Simulador de Impacto

O simulador utiliza o mesmo motor da Time Machine, mas injeta uma transação hipotética no fluxo.
*   **Impacto à Vista**: Reduz a liquidez imediatamente e recalcula a data de saída de dívida.
*   **Impacto Parcelado**: Distribui o valor nos meses futuros e verifica se em algum ponto a liquidez cai abaixo do nível de segurança.

---

> [!IMPORTANT]
> **Consistência**: O motor é validado por testes E2E que simulam cenários complexos (múltiplos cartões, rendas variáveis e metas simultâneas) para garantir que o saldo projetado na UI seja matematicamente impossível de estar errado.

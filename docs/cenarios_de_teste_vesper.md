# Bateria de Testes Vesper: Cenários e Resultados Esperados

Este documento mapeia o comportamento matematicamente esperado do Vesper (Single Source of Truth) para as diversas funcionalidades do sistema após a refatoração do domínio. Ele deve ser usado como guia para a criação de testes E2E, de Integração e Unitários.

---

## 1. Liquidez Líquida e Saldos Atuais (Snapshot Atual)

**Cenário 1.1: Liquidez Simples (Sem Cartões)**
- **Dados:** Conta Corrente (A) = R$ 1.500; Investimentos (B) = R$ 5.000. Nenhuma conta de cartão.
- **Esperado:** Liquidez Bruta (Ativos) = R$ 6.500. Dívida Total Consolidada = R$ 0. Liquidez Líquida Real = R$ 6.500.

**Cenário 1.2: Liquidez com Fatura de Cartão (Sem dívida externa)**
- **Dados:** Conta Corrente = R$ 2.000. Cartão de Crédito com Fatura Aberta = R$ 800, Fatura Fechada = R$ 400.
- **Esperado:** Liquidez Bruta = R$ 2.000. Dívida Consolidada = R$ 1.200. Liquidez Líquida Real = R$ 800.

**Cenário 1.3: Ciclo de Sobrevivência (Mês Atual)**
- **Dados:** Conta = R$ 500. Faturas Vencendo neste mês = R$ 300. Despesas manuais a vencer no mês = R$ 100.
- **Esperado:** Liquidez de Ciclo Real = R$ 100 (R$ 500 - R$ 300 - R$ 100). O usuário pode gastar até R$ 100 sem entrar no vermelho.

---

## 2. Motor de Projeção (Monthly Outlook & Time Machine)

**Cenário 2.1: Projeção Básica Sem Cartões (Próximo Mês: +1)**
- **Dados:** Saldo Hoje = R$ 1.000. Receitas Recorrentes = R$ 5.000. Despesas Fixas Recorrentes = R$ 3.000. Sem metas. Sem orçamentos.
- **Esperado para Mês +1:** 
  - Saldo de Partida (Mês +1) = R$ 1.000 + (R$ 5.000 - R$ 3.000) = R$ 3.000.
  - Sobra Mensal = R$ 2.000.
  - Projetado Final (Net Liquidity) = R$ 3.000.

**Cenário 2.2: Projeção Avançada com Parcelamento de Cartão (Mês +3)**
- **Dados:** Saldo Hoje = R$ 500. Compra Parcelada Feita Hoje = R$ 900 (3x de R$ 300). Receitas = R$ 3.000. Despesas = R$ 2.000.
- **Esperado:**
  - Sobra Limpa = R$ 1.000.
  - Mês 0 (Hoje): Liquidez Líquida = R$ 500 - R$ 900 = -R$ 400 (Dívida Global R$ 900).
  - Mês 1: Saldo Bruto = R$ 500 + R$ 1.000 - R$ 300 = R$ 1.200. Dívida Restante = R$ 600. Liquidez Líquida = R$ 600.
  - Mês 2: Saldo Bruto = R$ 1.200 + R$ 1.000 - R$ 300 = R$ 1.900. Dívida Restante = R$ 300. Liquidez = R$ 1.600.
  - Mês 3: Saldo Bruto = R$ 1.900 + R$ 1.000 - R$ 300 = R$ 2.600. Dívida Restante = R$ 0. Liquidez = R$ 2.600.

**Cenário 2.3: Sweep Automático (Fundo de Sobrevivência)**
- **Dados:** Saldo Hoje = R$ 5.000. Fundo Sobrevivência Configurado = R$ 2.000. Dívida Global Ativa = R$ 1.500. Nenhuma Receita/Despesa futura.
- **Esperado:** O motor deve identificar que os R$ 5.000 superam o fundo de R$ 2.000 em R$ 3.000. Como a dívida é R$ 1.500, no primeiro mês simulado (+1), o sistema "quita" a dívida virtualmente (Sweep) e o saldo cai para R$ 3.500, com Dívida Consolidada R$ 0.

---

## 3. Comportamento do Cartão de Crédito e Faturas

**Cenário 3.1: Fechamento Natural da Fatura**
- **Dados:** Compra de R$ 50 feita dia 10. Fechamento dia 15. Vencimento dia 20.
- **Antes do Dia 15:** A compra aparece no `open_invoice_cents`.
- **Após o Dia 15:** O motor/cron de fechamento deve transferir R$ 50 de `open_invoice_cents` para `closed_invoice_cents` e criar (ou atualizar) a Fatura Aberta para o mês seguinte (começando zerada).

**Cenário 3.2: Pagamento Completo da Fatura Fechada**
- **Dados:** Fatura Fechada = R$ 1.000. Saldo Conta Corrente = R$ 3.000. Usuário paga fatura usando saldo.
- **Esperado (No Momento do Pagamento):** 
  - Saldo Conta Corrente subtrai R$ 1.000 (novo saldo R$ 2.000).
  - Fatura Fechada é zerada (R$ 0).
  - Transação de pagamento (tipo `EXPENSE`, categoria Pagamento de Cartão) é registrada, mas classificada como neutra (`is_adjustment`/ignorado no fluxo de caixa orgânico para não ser cobrada duplamente).

**Cenário 3.3: Pagamento Antecipado da Fatura Aberta**
- **Dados:** Fatura Fechada = R$ 0. Fatura Aberta = R$ 500. Usuário paga R$ 500 antecipado.
- **Esperado:** Saldo CC reduz em R$ 500. Fatura Aberta é reduzida para R$ 0. Limite do cartão é restabelecido.

**Cenário 3.4: Pagamento Parcial (Fatura Fechada de R$ 1.000, paga R$ 600)**
- **Dados:** Fatura Fechada = R$ 1.000. Pagamento de R$ 600.
- **Esperado:** Saldo CC reduz R$ 600. Fatura Fechada fica em R$ 400 (remanescente). No vencimento, o remanescente será renegociado (com juros) ou transferido, dependendo de como o usuário registrar.

---

## 4. Teto Semanal (Controle de Gasto Variável)

**Cenário 4.1: Teto Semanal Padrão com Margem Limpa**
- **Dados:** Sobra Limpa (Receitas Frequentes - Despesas Frequentes) = R$ 2.000. Semanas restantes no mês = 4.
- **Esperado:** Limite Semanal Base = R$ 500. Status = `NORMAL`.

**Cenário 4.2: Teto Semanal Crítico (Gasto Acima do Permitido)**
- **Dados:** Sobra Limpa = R$ 1.000. Limite = R$ 250/semana. Transações variáveis realizadas nos últimos 7 dias = R$ 280.
- **Esperado:** Consumo Semanal Atual = R$ 280. `remainingCents` = -R$ 30. Status = `CRITICAL`.

**Cenário 4.3: Piso de Sobrevivência**
- **Dados:** Sobra Limpa = R$ 0. Saldo em Conta = R$ 10.
- **Esperado:** O Limite Semanal não pode ser R$ 0. Deve assumir o mínimo de `MIN_WEEKLY_LIMIT_CENTS` (R$ 50), alertando `WARNING` imediato, garantindo que o app forneça balizamento humano viável.

---

## 5. Simulações (Impacto de Decisões)

**Cenário 5.1: Simulação de Compra Parcelada (DANGER)**
- **Dados:** Sobra Limpa Mensal = R$ 300. Usuário simula compra de R$ 2.500 em 10x de R$ 250.
- **Esperado:** A parcela consumirá 83% da sobra. Status deve retornar `DANGER` ou `WARNING`, avisando que o caixa ficará sufocado por 10 meses.

**Cenário 5.2: Simulação de Empréstimo Pessoal para Troca de Dívida**
- **Dados:** Dívida atual cartão rotativo = R$ 5.000 (taxa média alta do Brasil, assumido 14% a.m.). Usuário simula empréstimo de R$ 5.000 (Receita) para pagar em 24x de R$ 350 (CET implícito de 6% a.m.).
- **Esperado:** O motor injeta +R$ 5.000 no mês 0 (quitando a dívida líquida atual). No fluxo de caixa futuro (+1 a +24), o motor desconta R$ 350 mensais. `is_debt_swap_advantageous` deve retornar `true`. A mensagem deve afirmar que "Compensa! Trocar a dívida reduzirá o custo mensal e protegerá a liquidez."

---

## 6. Projeção de Saída de Dívida e Metas (Debt Exit & Goals)

**Cenário 6.1: Calculando Saída de Dívida (O(1) sem loops eternos)**
- **Dados:** Liquidez Líquida = -R$ 4.000. Sobra Mensal = R$ 1.000.
- **Esperado:** `monthsToExit` = 4 meses. A data `exitDate` deve ser o mês exato daqui a 4 meses.

**Cenário 6.2: Efeito "Bola de Neve" Invertida (Sobra < 0)**
- **Dados:** Liquidez = -R$ 2.000. Sobra Mensal = -R$ 500 (Déficit).
- **Esperado:** `monthsToExit` deve retornar fallback 999 meses. A data de saída será `null`.

**Cenário 6.3: Foco em Metas Adiado**
- **Dados:** Dívida Existente. `monthsToExit` = 4 meses. Duas Metas: Meta A (R$ 2.000, Prioridade 1), Meta B (R$ 5.000, Prioridade 2). Sobra Mensal Projetada = R$ 1.000. Razão de Alocação (`goalAllocationRatio`) = 50% (R$ 500 para metas).
- **Esperado:** 
  - Nenhuma meta pode receber fundos ou focar agora (`canFocusNow = false`, `monthsToStart = 4`). 
  - A Meta A levará R$ 2.000 / R$ 500 = 4 meses de esforço. Completará no mês 4 (Debt Exit) + 4 = Mês 8. 
  - A Meta B começa a focar no Mês 8. Completará 10 meses após o Mês 8 (Mês 18).

---

## 7. Edge Cases Mapeados (Cenários Críticos)

- **EC 1: Double-Counting de Faturas Mês 0:** Se uma transação do cartão de crédito ainda não foi paga, mas já está na Fatura Fechada do `Account`, o motor **não** deve deduzir o valor da transação no fluxo de caixa orgânico, deduzindo apenas a dívida consolidada do cartão (via `immediateCardDebt`).
- **EC 2: Fuso Horário e ISO Date:** Uma transação inserida dia 31 de Janeiro (2026-01-31T01:00:00Z) deve ser contabilizada para **Janeiro**, e não Fevereiro, ignorando o impacto do fuso local caso UTC vaze. `parseLocalDate` assegura `isSameMonth` correto.
- **EC 3: Recorrentes Expiradas:** Despesa configurada até Julho/2026. Ao projetar Agosto/2026 usando o `calculateAdvancedProjection(monthOffset = 2)`, a despesa deve ter `amount_cents` = 0.
- **EC 4: Fechamento de Metas (Completion):** Se `monthlySurplusCents` disparar com um 13º salário extra que abata toda a dívida no mês atual, a Meta A automaticamente reflete `canFocusNow = true` para o mês seguinte.
- **EC 5: Refund/Estorno de Cartão:** Se um lojista devolver um valor (tipo INCOME no cartão de crédito), ele entra como crédito na Fatura Aberta (deduzindo a fatura corrente e a Dívida Total), mas **não entra** como Receita Orgânica para composição da Margem Livre Semanal.

---
**Documentação Ativa**: Ao codificar fluxos E2E com o Playwright e TestSprite, utilize os inputs definidos em cada **Dados** e verifique os valores precisos em **Esperado**. Falhar em prever estes cenários significa violar as 21 regras de consistência da arquitetura SSOT do Vesper.

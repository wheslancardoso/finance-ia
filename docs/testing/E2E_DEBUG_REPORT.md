# Relatório de Debug: Estabilização de Testes E2E (Dashboard)

Este documento contextualiza o estado atual da suíte de testes E2E, focando no bug persistente de sincronização de projeções no Dashboard.

## Status Atual
- **Total de Testes:** 34
- **Passando:** 31
- **Falhando:** 2 (Ambos no `tests/dashboard.test.ts`)
- **Bloqueio:** O cálculo de "Sobra Livre" e "Modo Crise" no Dashboard não está processando corretamente as transações recorrentes (assinaturas/salários) fornecidas pelos mocks durante a execução do Playwright.

---

## O Problema: `10.000,00` vs `8.000,00`

Nos testes do Dashboard, injetamos um Salário (10k) e um Aluguel (2k). O esperado é uma sobra de **8k**. No entanto, o sistema reporta consistentemente **10k**, ignorando o Aluguel.

### Descobertas Técnicas:
1. **Mock API:** Confirmamos via logs que a API mockada (`/api/financial-state`) está entregando os dados corretamente (incluindo o Aluguel).
2. **Contexto (Frontend):** O `FinancialDataContext` recebe os dados, mas o filtro de `recurring_transactions` falha na comparação de datas.
3. **Falha de Comparação:** Mesmo com datas futuras (ex: dia 15 do mês atual), a condição `nextDate >= startOfToday` retorna `false` no ambiente de teste, apesar de os timestamps indicarem que o valor é maior.

---

## Ações Realizadas Até Agora

1. **Refatoração da Infraestrutura:** Migramos todos os testes para uma arquitetura baseada em `setupFinancialMocks`, eliminando dependências de banco de dados real e RLS.
2. **Padronização de Datas:** Alteramos o `FinancialDataContext.tsx` para usar `.getTime()` em todas as comparações de data, buscando evitar discrepâncias de fuso horário entre o terminal e o browser.
3. **Logs de Diagnóstico:** Injetamos logs detalhados tanto na API Mock quanto no Contexto React para rastrear o fluxo de dados.
4. **Retry Logic (toPass):** Implementamos asserções com polling (`toPass`) para garantir que o React tenha tempo de processar o estado após reloads de página.
5. **Correção de Lints:** Resolvemos diversos erros de tipagem introduzidos durante o processo de debug no `FinancialDataContext.tsx`.

---

## Possíveis Próximos Passos

1. **Investigar `startOfToday` no Browser:**
   - O cálculo de `startOfToday` no Contexto usa o fuso horário local do browser. O Playwright roda em UTC por padrão. 
   - **Hipótese:** Se o browser entende que "hoje" começou em um timestamp à frente da transação mockada, ele a exclui.
   - **Ação:** Forçar o timezone nos testes ou simplificar o filtro para comparar apenas mês/ano.

2. **Remover Logs de Debug:**
   - Após resolver o problema, é necessário limpar os `console.log` e variáveis temporárias adicionadas ao `FinancialDataContext.tsx` e `financialMocks.ts`.

3. **Finalizar `tests/dashboard.test.ts`:**
   - Uma vez corrigido o filtro, os testes de "Modo Crise" e "Sincronização de Assinaturas" devem passar naturalmente.

4. **Revisar `simulator.test.ts`:**
   - O simulador agora funciona deterministicamente com os mocks, mas deve ser validado junto com a correção do Dashboard, pois compartilham a lógica de `useFinancialAnalysis`.

---

## Resumo para Retomada
O projeto está com 90%+ de cobertura E2E funcional. O último gargalo é puramente uma **discrepância de comparação de datas no ambiente de teste** que afeta as projeções do Dashboard. A lógica de negócio em produção parece estar correta, o problema manifesta-se apenas quando as datas são injetadas via mock no Playwright.

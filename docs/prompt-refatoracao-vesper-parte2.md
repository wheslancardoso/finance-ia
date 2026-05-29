# PROMPT DE REFATORAÇÃO ARQUITETURAL COMPLETA — VESPER FINANCE ENGINE

Você é um engenheiro de software sênior especialista em sistemas financeiros com React/TypeScript. Analise os três arquivos do sistema Vesper Finance (`financial-logic.ts`, `useFinancialAnalysis.ts`, `FinancialDataContext.tsx`) e aplique todas as correções e melhorias arquiteturais descritas abaixo.

**Objetivo central e inegociável:** tornar o sistema completamente **unidirecional e imutável**. O fluxo de dados deve ser uma via de mão única e sem retorno:

```
[Supabase/Dexie] → FinancialDataContext (dados brutos) → financial-logic.ts (cálculos puros) → useFinancialAnalysis (orquestração) → UI (apenas consome)
```

Nenhuma camada superior recalcula o que a camada inferior já calculou. Nenhuma função de domínio busca estado — ela recebe tudo como parâmetro. Nenhum componente de UI faz `.filter().reduce()`.

---

## BLOCO 1 — PROBLEMAS DE PERFORMANCE E COMPLEXIDADE ALGORÍTMICA

### PROBLEMA 1 — MOTOR DE PROJEÇÃO O(N²): LOOP DUPLICADO EM CASCADE

**Arquivo:** `financial-logic.ts`

**Diagnóstico:** `calculateMonthlyOutlook` contém um loop `for (let i = 1; i <= monthOffset; i++)` para calcular `projectedTotalDebt`. Em seguida, chama `calculateAdvancedProjection`, que executa um loop idêntico. Para `monthOffset = 6`, o sistema itera 12 vezes em vez de 6. Além disso, `calculateAdvancedProjection` atualmente retorna apenas `number` (o `projectedBalance`), mas já calcula `projectedTotalDebt` internamente e descarta esse valor — obrigando `calculateMonthlyOutlook` a refazê-lo do zero.

**Correção:**
- Altere `calculateAdvancedProjection` para retornar `{ projectedBalance: number; projectedTotalDebt: number }` em vez de `number`.
- Remova completamente o loop interno de cálculo de dívida de `calculateMonthlyOutlook`.
- `calculateMonthlyOutlook` deve chamar `calculateAdvancedProjection` uma única vez e consumir os dois valores do objeto retornado.
- Atualize todos os call sites que dependem do retorno de `calculateAdvancedProjection`.

---

### PROBLEMA 2 — DEDUPLICAÇÃO DE TRANSAÇÕES REPETIDA EM CADA CÁLCULO (5+ OCORRÊNCIAS)

**Arquivos:** `financial-logic.ts`, `useFinancialAnalysis.ts`, `FinancialDataContext.tsx`

**Diagnóstico:** O padrão abaixo aparece em pelo menos **7 locais** no codebase total (incluindo `_applyState`, o fallback de erro em `refreshData`, dentro de `calculateAdvancedProjection`, dentro do loop de `calculateMonthlyOutlook`, e dentro de `generateCashFlowStatement`):

```ts
const consolidatedTx = [...futureTransactions, ...allTransactions];
const uniqueTx = Array.from(new Map(consolidatedTx.map(t => [t.id, t])).values());
```

Cada call recria o array deduplicado do zero, mesmo quando os inputs não mudaram.

**Correção:**
1. Crie uma função utilitária pura em `financial-logic.ts`:
```ts
export function deduplicateTransactions(...txArrays: Transaction[][]): Transaction[]
```
2. Remova toda ocorrência inline do padrão `Array.from(new Map(...))` de dentro de funções de domínio. As funções de domínio devem receber arrays já limpos como parâmetros — nunca fazer deduplicação internamente.
3. Em `useFinancialAnalysis.ts`, crie um único `useMemo` consolidado:
```ts
const consolidatedTransactions = useMemo(() =>
  deduplicateTransactions(futureTransactions, allTransactions),
  [futureTransactions, allTransactions]
);
```
4. Em `FinancialDataContext.tsx`, use `deduplicateTransactions` dentro de `_applyState` e no bloco de fallback de erro, eliminando as duas ocorrências inline.
5. Passe `consolidatedTransactions` como parâmetro único para todos os calls de domínio que hoje recebem os dois arrays separados.

---

### PROBLEMA 3 — TRIPLE CALL DE `calculateMonthlyOutlook` POR RENDER CYCLE

**Arquivo:** `useFinancialAnalysis.ts`

**Diagnóstico:** Para o mesmo `monthOffset`, o hook executa `calculateMonthlyOutlook` **três vezes separadas**:
1. Dentro do `useMemo` de `cashFlowStatement` (calculando `prevOutlook` para `monthOffset - 1`)
2. Dentro do `useMemo` de `monthlyOutlook` (calculando o mês atual)
3. Dentro do `useMemo` de `startingBalanceCents` (novamente calculando `monthOffset - 1` com parâmetros ligeiramente diferentes)

As chamadas 1 e 3 calculam quase a mesma coisa com parâmetros similares — e têm divergência sutil: a chamada 1 usa `allTransactions` enquanto a chamada 3 usa `monthTransactions` no campo `allTransactions`. Isso cria inconsistência silenciosa além do desperdício computacional.

**Correção:**
- Crie um único `useMemo` chamado `prevMonthOutlook` que calcula `calculateMonthlyOutlook` para `monthOffset - 1` (retornando `null` quando `monthOffset === 0`).
- Corrija a inconsistência de qual array é passado — audite qual é semanticamente correto e documente.
- Os memos de `cashFlowStatement` e `startingBalanceCents` devem consumir `prevMonthOutlook` diretamente, sem chamar `calculateMonthlyOutlook` de novo.
- Invariante final: `calculateMonthlyOutlook` deve ser chamado **no máximo duas vezes** por render cycle: uma para `monthOffset - 1` (memoizado em `prevMonthOutlook`) e uma para o `monthOffset` corrente.

---

### PROBLEMA 4 — LÓGICA DE SIMULAÇÃO DUPLICADA EM 5 LOCAIS

**Arquivos:** `financial-logic.ts`, `useFinancialAnalysis.ts`

**Diagnóstico:** O código que itera sobre `activeSimulations` para calcular o impacto em um dado mês (verificando `startMonthOffset`, `installments`, `isLoan`, `interestRate`, `customInstallmentCents`) aparece em pelo menos **5 locais independentes**:
1. Dentro do loop de `calculateAdvancedProjection` (para meses 1..N)
2. Dentro do bloco de `monthOffset === 0` de `calculateAdvancedProjection` (simulações do mês corrente)
3. Dentro do loop de `calculateMonthlyOutlook` (loop de dívida que será eliminado pelo Problema 1)
4. No `useMemo` de `simulatedAssetsAdjustment` no hook
5. No `useMemo` de `simulatedNetImpact` no hook
6. No `useMemo` de `simulatedDebtAdjustment` no hook

Qualquer mudança na regra de simulação (ex: adicionar um novo tipo de simulação) exige alterar 5+ locais.

**Correção:**
1. Crie uma função pura em `financial-logic.ts`:
```ts
export function calculateSimulationImpactForMonth(
  simulations: Simulation[],
  monthOffset: number
): { incomeImpact: number; expenseImpact: number }
```
Esta função deve conter toda a lógica de: verificar `startMonthOffset`, checar se está dentro da janela de parcelas, calcular `calculateLoanInstallment` para empréstimos, aplicar `customInstallmentCents`, etc.

2. Substitua todas as 5+ ocorrências inline por chamadas a esta função.
3. Os `useMemo` de `simulatedAssetsAdjustment`, `simulatedDebtAdjustment` e `simulatedNetImpact` no hook devem ser **unificados em um único `useMemo`** chamado `simulationImpact` que retorna `{ assetsImpact, debtImpact, netImpact }`.

---

## BLOCO 2 — PROBLEMAS DE CORRETUDE E REGRAS DE NEGÓCIO

### PROBLEMA 5 — PARÂMETROS MORTOS EM `calculateAdvancedProjection`

**Arquivo:** `financial-logic.ts`

**Diagnóstico:** A assinatura de `calculateAdvancedProjection` recebe `scheduledIncomeCents` e `scheduledExpensesCents`, mas estes valores **nunca são usados** dentro do corpo da função. São aceitos e silenciosamente ignorados, criando confusão sobre o que alimenta o motor de projeção.

**Correção:** Remova `scheduledIncomeCents` e `scheduledExpensesCents` da interface de parâmetros. Atualize todos os call sites.

---

### PROBLEMA 6 — AMBIGUIDADE SEMÂNTICA `currentNetLiquidity` vs `currentAssetsCents`

**Arquivo:** `financial-logic.ts`

**Diagnóstico:** Em `calculateAdvancedProjection`:
```ts
const startBalance = currentAssetsCents !== undefined ? currentAssetsCents : currentNetLiquidity;
```
O saldo inicial de projeção é os **ativos brutos** (R$5.000 em conta corrente), mas a guarda de elegibilidade para aportes em metas usa `currentNetLiquidity` (patrimônio líquido = ativos − dívidas). Isso cria uma assimetria: a projeção acumula renda recorrente sobre um saldo já bruto sem descontar a dívida do ponto de partida, gerando projeções infladas. O parâmetro `currentAssetsCents` é `optional` mas na prática nunca deveria ser omitido.

**Correção:**
- Torne `currentAssetsCents` **obrigatório** (remova o `?`).
- Renomeie `currentNetLiquidity` para `liquidityHealthGuard` com JSDoc explícito dizendo que este valor é usado exclusivamente como guarda de condição para aportes em metas, nunca como saldo de partida.
- Documente no JSDoc da função que o motor parte dos **ativos brutos** e que o consumidor deve fazer `projectedBalance - projectedTotalDebt` para obter patrimônio líquido projetado.
- Remova o fallback `currentAssetsCents !== undefined ? currentAssetsCents : currentNetLiquidity`.

---

### PROBLEMA 7 — GUARDA DE DOUBLE-COUNT DE RENDA FRÁGIL

**Arquivo:** `financial-logic.ts` (dentro de `calculateMonthlyOutlook`)

**Diagnóstico:**
```ts
const hasIncomeTransactionInMonth = monthOffset === 0 && allTransactions?.some(t =>
  t.transaction_type === "INCOME" && isSameMonth(new Date(t.date), new Date())
);
```
Usa `.some()` que retorna `true` se **qualquer** transação de receita existir no mês — mesmo que seja `is_paid: false` (pendente, ainda não recebida). Isso pode zerar `adjustedMonthlyIncome` indevidamente quando o usuário tem receitas agendadas mas não confirmadas, fazendo o outlook projetar R$0 de renda quando na verdade há renda a caminho.

Adicionalmente, uma função de domínio **não deve filtrar arrays para descobrir estado** — isso é responsabilidade do caller.

**Correção:**
- Adicione o parâmetro `confirmedIncomeCents: number` na interface de `calculateMonthlyOutlook`.
- O caller (`useFinancialAnalysis`) — que já calcula `confirmedIncomeThisMonth` filtrando `is_paid === true` — deve passar esse valor.
- Substitua a lógica inline por:
```ts
const adjustedMonthlyIncome = (monthOffset === 0 && confirmedIncomeCents > 0)
  ? confirmedIncomeCents
  : monthlyIncome;
```
- Remova completamente o bloco `hasIncomeTransactionInMonth` e a query inline em `allTransactions` de dentro de `calculateMonthlyOutlook`.

---

### PROBLEMA 8 — FLOOR ARTIFICIAL EM `projectedTotalDebt` IMPEDE DEBT EXIT CORRETO

**Arquivo:** `financial-logic.ts` (fim de `calculateMonthlyOutlook`)

**Diagnóstico:**
```ts
if (monthOffset > 0) {
  const monthlyCommitments = installmentDebt + effectiveRecurringExpenses;
  projectedTotalDebt = Math.max(projectedTotalDebt, monthlyCommitments);
}
```
Força `projectedTotalDebt` a ser **no mínimo** a soma de compromissos do mês, mesmo quando a dívida real já foi amortizada abaixo desse valor. Isso impede que a Máquina do Tempo mostre corretamente que o usuário saiu das dívidas — a projeção de Debt Exit nunca converge para zero.

**Correção:** Remova este bloco completamente. Após o fix do Problema 1, o `projectedTotalDebt` retornado por `calculateAdvancedProjection` já refletirá o valor correto de amortização. Não aplique floors externos a cálculos de projeção pura.

---

### PROBLEMA 9 — `calculateRealCycleLiquidity` IGNORA DATA DE IMPACTO DO CARTÃO

**Arquivo:** `financial-logic.ts`

**Diagnóstico:**
```ts
.filter(t =>
  t.transaction_type === "EXPENSE" &&
  !t.is_paid &&
  isSameMonth(new Date(t.date), new Date()) // ← usa data da compra, não data de impacto
)
```
Uma compra feita em 28/maio em um cartão com fechamento dia 25 impacta a fatura de junho. Mas o filtro acima a inclui como despesa do ciclo de maio, inflando o passivo do mês corrente.

**Correção:**
```ts
.filter(t =>
  t.transaction_type === "EXPENSE" &&
  !t.is_paid &&
  isSameMonth(getTransactionImpactDate(t, accounts), new Date())
)
```
Garanta que `accounts: Account[]` seja passado como parâmetro obrigatório nesta função (já existe na interface, confirme que `getTransactionImpactDate` é chamado corretamente aqui).

---

### PROBLEMA 10 — `calculateDebtExitProjection` IGNORA PARCELAS DE CARTÃO

**Arquivo:** `financial-logic.ts`

**Diagnóstico:** A função calcula a saída de dívida assim:
```ts
const monthlySurplus = recurringIncomeCents - recurringExpensesCents - budgetTotal;
```
Mas **não desconta** o total de parcelamentos futuros de cartão. Um usuário com R$5.000 de renda, R$2.000 de despesas recorrentes e R$3.000 de parcelas de cartão vai aparecer como tendo R$3.000/mês de sobra — quando na realidade tem R$0. A data de saída da dívida projetada fica completamente errada.

**Correção:**
- Adicione o parâmetro `monthlyInstallmentsCents: number` na interface da função.
- O caller (hook) deve calcular e passar o total de parcelas do próximo mês usando `consolidatedTransactions`.
- A fórmula correta é:
```ts
const monthlySurplus = recurringIncomeCents - recurringExpensesCents - budgetTotal - monthlyInstallmentsCents;
```

---

### PROBLEMA 11 — `calculateWeeklySurvival` É CHAMADO COM `monthlySurplusCents: 0` E DESCARTADO

**Arquivo:** `useFinancialAnalysis.ts`

**Diagnóstico:** Na linha onde `calculateWeeklySurvival` é chamado no hook:
```ts
const result = calculateWeeklySurvival({
  monthlySurplusCents: 0, // ← hardcoded como zero
  currentMonthTransactions: monthOffset === 0 ? monthTransactions : []
});
```
E imediatamente após, o hook **sobrescreve** `weeklyLimitCents` com seu próprio cálculo local. Isso significa que a função de domínio está sendo usada apenas para calcular `weeklySpentCents` — o que é literalmente a única parte que o domínio não sobrescreve. A função de domínio virou um wrapper vazio.

**Correção:**
- Mova toda a lógica de cálculo do teto semanal (`freeMarginMonthly`, `weeksInPeriod`, `weeklyLimitCents`) para dentro de `calculateWeeklySurvival` em `financial-logic.ts`.
- A função deve receber os parâmetros necessários: `recurringIncomeCents`, `recurringExpensesCents`, `monthOffset`, `targetAssetsCents`, `currentMonthTransactions`.
- Remova completamente a lógica de teto semanal inline do hook.
- O piso mínimo de R$50/semana (5000 centavos) deve ser uma **constante exportada** de `financial-logic.ts`, não um número mágico embutido no hook.

---

### PROBLEMA 12 — `effectiveScheduledIncome || recurringIncomeCents` É SEMANTICAMENTE INCORRETO

**Arquivo:** `useFinancialAnalysis.ts`

**Diagnóstico:**
```ts
const effectiveScheduledIncome = scheduledIncomeCents || recurringIncomeCents;
```
O operador `||` trata `scheduledIncomeCents === 0` como falsy, fazendo fallback para `recurringIncomeCents`. Mas `0` é um valor legítimo: significa que não há mais renda agendada para os dias restantes do mês (o salário já caiu). Neste caso, o sistema deveria usar `0`, não a renda mensal total como substituto, o que infla artificialmente a projeção do mês corrente.

**Correção:**
```ts
const effectiveScheduledIncome = scheduledIncomeCents !== 0
  ? scheduledIncomeCents
  : recurringIncomeCents;
```
Mas de preferência, revise se este fallback deve existir de forma diferente: se `scheduledIncomeCents` é zero porque todas as rendas do mês já foram recebidas, o correto é passar `0`. Se for zero por ausência de configuração de recorrentes, aí sim o fallback para `recurringIncomeCents` faz sentido. Adicione JSDoc explicando a semântica esperada.

---

## BLOCO 3 — PROBLEMAS DE SEPARAÇÃO DE RESPONSABILIDADES

### PROBLEMA 13 — LÓGICA DE NEGÓCIO DUPLICADA NO CONTEXT

**Arquivos:** `FinancialDataContext.tsx` e `financial-logic.ts`

**Diagnóstico:** As funções `getIncomeMix` e `getNetWorthHistory` estão implementadas **dentro do Context** como `useCallback` com corpo completo, mas versões equivalentes `calculateIncomeMix` e `calculateNetWorthHistory` já existem em `financial-logic.ts`. O Context reescreve lógica de domínio, criando duas implementações que podem divergir silenciosamente.

Há diferenças sutis: a versão do Context em `getNetWorthHistory` usa `monthTransactions` (apenas transações do mês), enquanto `calculateNetWorthHistory` em `financial-logic.ts` usa `transactions` (escopo mais amplo). Isso significa que as duas funções retornam valores diferentes para o mesmo dado.

**Correção:**
- Remova as implementações inline de `getIncomeMix` e `getNetWorthHistory` do `FinancialDataContext`.
- Substitua por delegates simples que chamam as funções de domínio com os parâmetros corretos:
```ts
const getIncomeMix = useCallback(() =>
  calculateIncomeMix(monthTransactions, budgets),
  [monthTransactions, budgets]
);

const getNetWorthHistory = useCallback(() =>
  calculateNetWorthHistory(accounts, allTransactions), // usar allTransactions, não monthTransactions
  [accounts, allTransactions]
);
```
- Defina explicitamente qual array é o correto para cada função e documente.

---

### PROBLEMA 14 — `simulatePurchaseImpact` NO CONTEXT FAZ CHAMADA DE REDE PARA ALGO QUE JÁ EXISTE NO DOMÍNIO

**Arquivo:** `FinancialDataContext.tsx`

**Diagnóstico:** `simulatePurchaseImpact` no Context chama `financialService.simulatePurchaseImpact(userId, amountCents)` — uma chamada de rede ao backend — para calcular o impacto de uma compra. Mas `simulateDetailedImpact` em `financial-logic.ts` já faz exatamente isso localmente, com muito mais detalhes e sem latência de rede.

**Correção:**
- Remova `simulatePurchaseImpact` do Context (ou marque como deprecated).
- Os componentes que precisam simular impacto devem usar `useFinancialAnalysis()` que já expõe `simulateDetailedImpact` como função local pura.
- Se o backend precisa desta lógica por outros motivos (analytics, auditoria), mantenha no serviço, mas não exponha via Context como substituto do cálculo local.

---

### PROBLEMA 15 — `checkingBalance` RECALCULADO INLINE NO HOOK

**Arquivo:** `useFinancialAnalysis.ts`

**Diagnóstico:**
```ts
const checkingBalance = useMemo(() => {
  return accounts
    .filter(a => a.type !== "CREDIT_CARD")
    .reduce((sum, a) => sum + (Number(a.balance_cents) || 0), 0);
}, [accounts]);
```
Isso é idêntico a `calculateAccumulatedBalance(accounts)` que já existe em `financial-logic.ts`. O hook está reimplementando uma função de domínio existente.

**Correção:** Substitua por `useMemo(() => calculateAccumulatedBalance(accounts), [accounts])` e importe a função do domínio.

---

### PROBLEMA 16 — INTERFACE `MonthlyOutlook` DECLARADA DUAS VEZES

**Arquivo:** `financial-logic.ts`

**Diagnóstico:** A interface `MonthlyOutlook` é declarada duas vezes no mesmo arquivo — uma vez na linha ~15 e outra vez na linha ~265. Isso causa erro de TypeScript ("Duplicate identifier") ou comportamento indefinido dependendo da versão do compilador/configuração.

**Correção:** Remova a declaração duplicada. Mantenha apenas uma, próxima da função que a usa (`calculateMonthlyOutlook`), com todos os campos corretamente documentados via JSDoc.

---

## BLOCO 4 — PROBLEMAS DE FRAGILIDADE E BUGS LATENTES

### PROBLEMA 17 — TIMEZONE FRAGILITY EM `getTransactionImpactDate` E EM TODO USO DE `new Date(t.date)`

**Arquivo:** `financial-logic.ts` (e propagado em todos os arquivos)

**Diagnóstico:** Para strings de data no formato `"2024-05-28"` (sem horário), `new Date("2024-05-28")` é interpretado como **UTC midnight** pela especificação ECMAScript. Em fusos horários negativos (ex: UTC-3, Brasil), isso resulta em `2024-05-27T21:00:00` localmente — ou seja, a transação de 28/maio aparece como sendo do dia 27/maio. Isso afeta diretamente a comparação de fechamento de cartão (`day >= closingDay`) em `getTransactionImpactDate`.

**Correção:**
1. Crie uma função utilitária em `financial-logic.ts`:
```ts
export function parseLocalDate(dateStr: string): Date {
  // Força interpretação como data local, não UTC
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}
```
2. Substitua todos os `new Date(t.date)`, `new Date(r.next_date)` e `new Date(r.date)` em funções de domínio por `parseLocalDate(t.date)`.
3. Funções que já fazem split manual (como `calculateScheduledIncome`) estão corretas — confirme que são consistentes.

---

### PROBLEMA 18 — TRANSAÇÕES VIRTUAIS RECORRENTES USAM `toISOString()` COMO DATA

**Arquivo:** `financial-logic.ts` (dentro de `generateCashFlowStatement`)

**Diagnóstico:**
```ts
date: targetMonth.toISOString(), // targetMonth = startOfMonth(targetDate)
```
`startOfMonth` retorna midnight local, mas `.toISOString()` converte para UTC. Em UTC-3, isso gera `"2024-06-01T03:00:00.000Z"` para junho — quando depois passado de volta por `new Date(t.date)` em outro ponto do código, pode resultar em 31/maio às 21:00 local, jogando a transação virtual para o mês errado.

**Correção:** Use `format(targetMonth, "yyyy-MM-dd")` da `date-fns` ao invés de `.toISOString()` para datas de transações virtuais. Em conjunto com a função `parseLocalDate` do Problema 17, o sistema passa a trabalhar exclusivamente com datas locais.

---

### PROBLEMA 19 — `calculateNetWorthHistory` RECONSTRÓI PATRIMÔNIO SEM CONSIDERAR EVOLUÇÃO DA DÍVIDA DE CARTÃO

**Arquivo:** `financial-logic.ts`

**Diagnóstico:** A função tenta reconstruir o patrimônio líquido histórico revertendo transações mês a mês. Mas usa `accounts.balance_cents` como ponto de partida (saldo bruto atual) e aplica as transações sem considerar a evolução da dívida de cartão. O resultado é uma curva de patrimônio que reflete apenas movimentação em conta corrente, ignorando que os cartões tinham saldos diferentes nos meses anteriores.

**Correção:** Documente explicitamente no JSDoc que esta função retorna **patrimônio em conta corrente** (não patrimônio líquido real) e renomeie para `calculateCheckingBalanceHistory` para evitar confusão semântica com `calculateNetLiquidity`. Se quiser implementar o patrimônio líquido histórico real, seria necessário snapshots históricos dos saldos de cartão, que devem vir do banco de dados.

---

## BLOCO 5 — NAMING E CONTRATOS DE API INTERNA

### PROBLEMA 20 — NAMING MISMATCH: `allTransactions` PASSADO ONDE DEVERIA SER `monthTransactions`

**Arquivo:** `useFinancialAnalysis.ts`

**Diagnóstico:** A chamada a `calculateMonthlyOutlook` passa:
```ts
allTransactions: monthTransactions  // ← campo chamado allTransactions recebe monthTransactions
```
Enquanto a chamada para `startingBalanceCents` (Problema 3) passa o mesmo campo mas usa `allTransactions` do Context. Os dois calls usam arrays diferentes no mesmo parâmetro, produzindo resultados diferentes para o mesmo mês.

**Correção:** Após unificar em `prevMonthOutlook` (Problema 3), defina claramente qual array é semanticamente correto: o parâmetro `allTransactions` de `calculateMonthlyOutlook` deve receber o array `consolidatedTransactions` (deduplicado, escopo completo) criado no Problema 2. Adicione JSDoc ao parâmetro de `calculateMonthlyOutlook` especificando que ele espera transações de **escopo amplo** (recent + month + future deduplicados), não apenas do mês corrente.

---

### PROBLEMA 21 — `calculateGoalProjections` USA ALOCAÇÃO HARDCODED DE 50%

**Arquivo:** `financial-logic.ts`

**Diagnóstico:**
```ts
const surplusForGoals = (debtExit.monthlySurplus || 0) * 0.5;
```
50% da sobra mensal é alocado para metas — sem possibilidade de configuração. É uma regra de negócio que deveria ser um parâmetro, não uma constante mágica embutida na função pura.

**Correção:** Adicione o parâmetro `goalAllocationRatio: number = 0.5` na interface da função. Exporte a constante padrão:
```ts
export const DEFAULT_GOAL_ALLOCATION_RATIO = 0.5;
```
O caller pode sobrescrever conforme preferência do usuário futuramente.

---

## ENTREGÁVEIS E INVARIANTES FINAIS

Após aplicar todas as correções, os três arquivos devem satisfazer as seguintes invariantes verificáveis:

**`financial-logic.ts`:**
- [ ] Não contém nenhuma ocorrência de `Array.from(new Map(...))` — toda deduplicação vem de parâmetros já limpos.
- [ ] `calculateAdvancedProjection` retorna `{ projectedBalance: number; projectedTotalDebt: number }` e executa um único loop de 1 até `monthOffset`.
- [ ] `MonthlyOutlook` é declarada exatamente **uma vez**.
- [ ] `calculateSimulationImpactForMonth` existe e é a única implementação da lógica de simulação por mês.
- [ ] `parseLocalDate` existe e é usada em toda conversão de string para Date.
- [ ] `calculateWeeklySurvival` recebe parâmetros suficientes para calcular o teto semanal completo sem que o caller precise sobrescrever nada.
- [ ] `calculateDebtExitProjection` recebe e usa `monthlyInstallmentsCents`.

**`useFinancialAnalysis.ts`:**
- [ ] `calculateMonthlyOutlook` é chamado **no máximo 2 vezes** por render: `prevMonthOutlook` e `monthlyOutlook`.
- [ ] Existe um único `useMemo` de `consolidatedTransactions` que é passado para todos os calls subsequentes.
- [ ] `simulatedAssetsAdjustment`, `simulatedDebtAdjustment` e `simulatedNetImpact` são unificados em um único `useMemo` de `simulationImpact`.
- [ ] `checkingBalance` chama `calculateAccumulatedBalance`, não reimplementa o cálculo.
- [ ] Não existe nenhum `.filter(...).reduce(...)` calculando saldo financeiro — apenas `calculateWeeklySurvival` é chamado e seu resultado é usado diretamente.

**`FinancialDataContext.tsx`:**
- [ ] Não contém nenhuma implementação de cálculo financeiro — apenas delegates para funções de `financial-logic.ts`.
- [ ] `getIncomeMix` e `getNetWorthHistory` são delegates puros.
- [ ] `deduplicateTransactions` é usado em `_applyState` e no bloco de fallback de erro.
- [ ] O Context não expõe `simulatePurchaseImpact` como chamada de rede para algo calculável localmente.

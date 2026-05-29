Analisei os três arquivos com atenção. O que segue é o prompt completo, pronto para você passar à outra IA.

---

**PROMPT PARA REFATORAÇÃO DO MOTOR DE PROJEÇÃO FINANCEIRA (VESPER)**

---

Você é um engenheiro de software sênior especialista em sistemas financeiros com React/TypeScript. Analise os três arquivos do sistema Vesper Finance (`financial-logic.ts`, `useFinancialAnalysis.ts`, `FinancialDataContext.tsx`) e aplique as correções e melhorias arquiteturais descritas abaixo. O objetivo central é tornar o sistema **imutável e cascata-driven**: cada camada apenas "puxa" dados calculados pela camada abaixo, sem recalcular nada por conta própria.

---

### PROBLEMA 1 — MOTOR DE PROJEÇÃO O(N²) EM CASCADE

**Arquivo:** `financial-logic.ts`

**Diagnóstico:** `calculateMonthlyOutlook` contém um loop `for (let i = 1; i <= monthOffset; i++)` para calcular `projectedTotalDebt`. Em seguida, a mesma função chama `calculateAdvancedProjection`, que contém um loop `for (let i = 1; i <= monthOffset; i++)` idêntico. Para `monthOffset = 6`, o sistema itera 12 vezes em vez de 6 — complexidade O(N²) à medida que o usuário navega para meses distantes.

**Correção:** Extraia o loop de projeção de débito de dentro de `calculateMonthlyOutlook`. Ambos os loops devem ser unificados em **um único loop em `calculateAdvancedProjection`**, que retorna um objeto `{ projectedBalance: number, projectedTotalDebt: number }` em vez de apenas `number`. Atualize `calculateMonthlyOutlook` para consumir este resultado consolidado, eliminando completamente seu loop interno de cálculo de dívida.

---

### PROBLEMA 2 — PARÂMETROS MORTOS EM `calculateAdvancedProjection`

**Arquivo:** `financial-logic.ts`

**Diagnóstico:** A assinatura de `calculateAdvancedProjection` recebe `scheduledIncomeCents` e `scheduledExpensesCents`, mas estes valores **nunca são usados** dentro do corpo da função. Eles são apenas aceitos e ignorados, criando confusão sobre o que realmente alimenta o motor de projeção.

**Correção:** Remova `scheduledIncomeCents` e `scheduledExpensesCents` da interface de parâmetros de `calculateAdvancedProjection`. Atualize todos os call sites do código que passam esses valores para essa função.

---

### PROBLEMA 3 — AMBIGUIDADE `currentNetLiquidity` vs `currentAssetsCents` NO STARTING BALANCE

**Arquivo:** `financial-logic.ts`

**Diagnóstico:** Em `calculateAdvancedProjection`, a linha:
```ts
const startBalance = currentAssetsCents !== undefined ? currentAssetsCents : currentNetLiquidity;
```
usa `currentAssetsCents` (ativos brutos, ex: R$5.000 em conta corrente) como ponto de partida, mas ao mesmo tempo o parâmetro `currentNetLiquidity` (patrimônio líquido = ativos − dívidas) é usado como guarda de elegibilidade para aportes em metas (`if (currentNetLiquidity >= 0 ...)`). Isso cria uma assimetria semântica: o saldo inicial projetado é "bruto" mas a guarda de saúde financeira é "líquida". Para meses futuros, a projeção acumula renda recorrente sobre um saldo já bruto, sem descontar a dívida de cartão do ponto de partida, gerando projeções infladas.

**Correção:** Renomeie o parâmetro `currentNetLiquidity` para `currentLiquidityForHealthGuard` (use apenas como guarda de condição), e torne `currentAssetsCents` um parâmetro obrigatório (sem fallback para `currentNetLiquidity`). Documente explicitamente no JSDoc que o motor de projeção parte dos **ativos brutos** e que a dívida é tratada como passivo separado (subtração explícita no retorno), garantindo que o consumidor do resultado faça `projectedBalance - projectedTotalDebt` para obter o patrimônio líquido projetado.

---

### PROBLEMA 4 — TRIPLE CALL DE `calculateMonthlyOutlook` EM `useFinancialAnalysis.ts`

**Arquivo:** `useFinancialAnalysis.ts`

**Diagnóstico:** Para o mesmo `monthOffset`, o hook executa `calculateMonthlyOutlook` **três vezes separadas**:
1. Dentro do `useMemo` de `cashFlowStatement` (calculando `prevOutlook` para `monthOffset - 1`)
2. Dentro do `useMemo` de `monthlyOutlook` (calculando o mês atual)
3. Dentro do `useMemo` de `startingBalanceCents` (novamente calculando `monthOffset - 1`)

As chamadas 1 e 3 calculam exatamente a mesma coisa com os mesmos parâmetros.

**Correção:** Crie um único `useMemo` chamado `prevMonthOutlook` que calcula `calculateMonthlyOutlook` para `monthOffset - 1` (e retorna `null` quando `monthOffset === 0`). Faça os memos de `cashFlowStatement` e `startingBalanceCents` consumirem `prevMonthOutlook.totalAssets` diretamente, eliminando os dois calls redundantes.

---

### PROBLEMA 5 — DEDUPLICAÇÃO DE TRANSAÇÕES REPETIDA EM CADA CÁLCULO

**Arquivos:** `financial-logic.ts`, `useFinancialAnalysis.ts`

**Diagnóstico:** O padrão abaixo aparece pelo menos **5 vezes** no codebase:
```ts
const consolidatedTx = [...futureTransactions, ...allTransactions];
const uniqueTx = Array.from(new Map(consolidatedTx.map(t => [t.id, t])).values());
```
Cada call a `calculateAdvancedProjection`, `calculateMonthlyOutlook` e `generateCashFlowStatement` recria esse array deduplicado do zero, mesmo quando os arrays de entrada não mudaram.

**Correção:** Crie uma função utilitária pura em `financial-logic.ts`:
```ts
export function deduplicateTransactions(txArrays: Transaction[][]): Transaction[]
```
Mais importante: em `useFinancialAnalysis.ts`, crie **um único `useMemo`** que calcula o array consolidado e deduplicado:
```ts
const consolidatedTransactions = useMemo(() => 
  deduplicateTransactions([futureTransactions, allTransactions]),
  [futureTransactions, allTransactions]
);
```
Passe este array único para todos os calls subsequentes de funções do domain, substituindo todas as 5+ instâncias do padrão inline.

---

### PROBLEMA 6 — GUARDA DE DOUBLE-COUNT DE RENDA FRÁGIL

**Arquivo:** `financial-logic.ts` (dentro de `calculateMonthlyOutlook`)

**Diagnóstico:** A lógica:
```ts
const hasIncomeTransactionInMonth = monthOffset === 0 && allTransactions?.some(t =>
  t.transaction_type === "INCOME" && isSameMonth(new Date(t.date), new Date())
);
```
usa `.some()` que retorna `true` se **qualquer** transação de receita existir no mês — mesmo que ela seja do tipo `is_paid: false` (pendente). Isso pode zerar `adjustedMonthlyIncome` indevidamente quando o usuário tem receitas agendadas mas ainda não recebidas.

**Correção:** Substitua a guarda por um parâmetro explícito `confirmedIncomeCents: number` na interface de `calculateMonthlyOutlook`. O caller (`useFinancialAnalysis`) — que já calcula `confirmedIncomeThisMonth` corretamente filtrando `is_paid === true` — deve passar esse valor. Dentro de `calculateMonthlyOutlook`, use:
```ts
const adjustedMonthlyIncome = (monthOffset === 0 && confirmedIncomeCents > 0)
  ? confirmedIncomeCents
  : monthlyIncome;
```
Remova completamente o bloco `hasIncomeTransactionInMonth` e a query inline em `allTransactions` de dentro de `calculateMonthlyOutlook`. Funções de domain **não devem filtrar arrays para descobrir estado** — devem receber o estado já resolvido como parâmetro.

---

### PROBLEMA 7 — FLOOR ARTIFICIAL NA `projectedTotalDebt`

**Arquivo:** `financial-logic.ts` (fim de `calculateMonthlyOutlook`)

**Diagnóstico:** O bloco ao final da função:
```ts
if (monthOffset > 0) {
  const monthlyCommitments = installmentDebt + effectiveRecurringExpenses;
  projectedTotalDebt = Math.max(projectedTotalDebt, monthlyCommitments);
}
```
força `projectedTotalDebt` a ser **no mínimo** a soma de compromissos do mês, mesmo que a dívida real já tenha sido amortizada abaixo desse valor. Isso produz um "piso artificial" que impede que a Máquina do Tempo mostre um usuário saindo das dívidas antes do esperado.

**Correção:** Remova este bloco completamente. Se a projeção de amortização em cascata estiver correta (após o fix do Problema 1), o `projectedTotalDebt` final já refletirá o valor real. Não aplique floors externos a cálculos de projeção pura.

---

### PROBLEMA 8 — `calculateRealCycleLiquidity` IGNORA IMPACTO DE FECHAMENTO DE CARTÃO

**Arquivo:** `financial-logic.ts`

**Diagnóstico:** A função filtra despesas por:
```ts
isSameMonth(new Date(t.date), new Date())
```
mas ignora `getTransactionImpactDate`. Isso significa que uma compra feita em 28/maio em um cartão com fechamento dia 25 (que impacta a fatura de junho) é **incorretamente incluída** como despesa do ciclo de maio, inflando o passivo do mês corrente.

**Correção:** Substitua o filtro por:
```ts
.filter(t =>
  t.transaction_type === "EXPENSE" &&
  !t.is_paid &&
  isSameMonth(getTransactionImpactDate(t, accounts), new Date())
)
```
Adicione `accounts: Account[]` como parâmetro obrigatório de `calculateRealCycleLiquidity` (já está na interface, apenas garanta que `getTransactionImpactDate` seja chamado aqui).

---

### PROBLEMA 9 — DUPLICAÇÃO DE LÓGICA ENTRE CONTEXT E DOMAIN

**Arquivos:** `FinancialDataContext.tsx` e `financial-logic.ts`

**Diagnóstico:** As funções `getIncomeMix` e `getNetWorthHistory` estão implementadas **dentro do Context** como `useCallback`, mas versões equivalentes `calculateIncomeMix` e `calculateNetWorthHistory` já existem em `financial-logic.ts`. O Context reescreve a lógica de negócio que pertence ao domain.

**Correção:** Remova as implementações inline de `getIncomeMix` e `getNetWorthHistory` do `FinancialDataContext`. Substitua por `useCallback` simples que delegam para as funções de domain:
```ts
const getIncomeMix = useCallback(() => 
  calculateIncomeMix(monthTransactions, budgets), 
  [monthTransactions, budgets]
);

const getNetWorthHistory = useCallback(() => 
  calculateNetWorthHistory(accounts, allTransactions), 
  [accounts, allTransactions]
);
```
O Context não deve conter lógica de negócio — apenas orquestração de estado e chamadas ao domain.

---

### PROBLEMA 10 — NAMING MISMATCH: `allTransactions` PASSADO COMO `allTransactions` MAS É `monthTransactions`

**Arquivo:** `useFinancialAnalysis.ts`

**Diagnóstico:** A chamada a `calculateMonthlyOutlook` passa:
```ts
allTransactions: monthTransactions  // ← passando monthTransactions no campo allTransactions
```
mas em `calculateMonthlyOutlook`, o parâmetro `allTransactions` é usado para calcular `currentMonthPendingExpenses` e o guard de renda. Se `monthTransactions` e `allTransactions` (do Context) divergirem (ex: allTransactions inclui futureTransactions), a lógica usa o array errado.

**Correção:** Passe o `allTransactions` correto do Context (que inclui `recent + month + future` deduplicados) no campo `allTransactions` de `calculateMonthlyOutlook`. Audite todos os call sites desta função para confirmar qual array é semanticamente correto em cada contexto (mês atual vs. futuro). Adicione JSDoc aos parâmetros de `calculateMonthlyOutlook` especificando exatamente qual escopo temporal cada array deve cobrir.

---

### ENTREGÁVEIS ESPERADOS

Após aplicar todas as correções acima, os três arquivos devem satisfazer as seguintes invariantes:

1. **`financial-logic.ts`** contém apenas funções puras. Nenhuma função dentro deste arquivo executa `Array.from(new Map(...))` de deduplicação — recebe arrays já limpos como parâmetros.
2. **`useFinancialAnalysis.ts`** chama `calculateMonthlyOutlook` no máximo **duas vezes** por render cycle: uma para `monthOffset - 1` (memoizado em `prevMonthOutlook`) e uma para o `monthOffset` corrente.
3. **`calculateAdvancedProjection`** retorna `{ projectedBalance: number, projectedTotalDebt: number }` e executa um único loop de 1 a `monthOffset`.
4. **`FinancialDataContext.tsx`** não contém nenhuma implementação de cálculo financeiro — apenas chama funções de `financial-logic.ts` ou `useFinancialAnalysis.ts`.
5. O array consolidado e deduplicado de transações é criado **uma única vez** em `useFinancialAnalysis` e passado como referência para todos os calls de domain.
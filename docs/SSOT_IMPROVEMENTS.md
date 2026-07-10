# Relatório de Melhorias: Refatoração do Motor Financeiro (SSOT)

Durante a nossa recente auditoria e centralização do Motor Financeiro (Single Source of Truth - SSOT), implementamos uma série de correções matemáticas estruturais. Abaixo está o resumo consolidado das melhorias técnicas e de negócios que foram entregues.

## 1. Correção do Bug de "Dívida Infinita" no Cartão de Crédito
- **O Problema:** A rota da API somava **todas** as faturas de cartão de crédito presentes no histórico do usuário para abater do saldo (`balance_cents`), incluindo faturas antigas que já estavam pagas (`PAID`). Isso criava um rombo cumulativo e irreal no patrimônio líquido do usuário.
- **A Solução:** Removemos essa lógica duplicada da rota (`route.ts`) e passamos a injetar o estado das faturas a partir da função oficial `enrichAccountsWithInvoices` dentro do `financial-logic.ts`. Agora, apenas faturas nos status `OPEN` ou `CLOSED` abatem o saldo real.

## 2. Respeito Rigoroso ao `excluded_months` no Mês Zero
- **O Problema:** Se o usuário marcasse uma despesa recorrente como "excluída" para o mês atual, essa despesa ainda "vazava" na projeção via o fluxo de "agendadas" (`calculateScheduledExpenses`), fazendo a conta não bater.
- **A Solução:** Filtros profundos para `excluded_months` foram introduzidos dentro de `calculateScheduledIncome` e `calculateScheduledExpenses`. O motor agora cruza a data de hoje contra a tabela de exclusões, garantindo precisão matemática também no mês atual, não apenas nos meses futuros.

## 3. Unificação das Projeções Avançadas e Metas
- **O Problema:** O hook de análise front-end (`useFinancialAnalysis`) tentava recalcular projeções de meses futuros de forma isolada, resultando em contagem dupla de dívidas já deduzidas pelo mês 0 e metas sendo infladas/recalculadas sobre um saldo base corrompido.
- **A Solução:** Todo o esforço de previsão foi centralizado em `calculateAdvancedProjection()`. O hook agora age apenas como um elo cego que lê a saída oficial do motor `financial-logic.ts`. Isso assegura que se houver alterações contábeis no futuro, a UI vai refletir sem exigir nenhuma nova adaptação.

## 4. Estabilização do Teto Semanal (Survival Rate)
- **O Problema:** Existiam lógicas de fallback paralelas e hardcoded na tela que podiam divergir dos valores reais de projeção caso uma despesa nova fosse agendada.
- **A Solução:** O limite de sobrevivência semanal passa a ser puramente dependente do `activeNetLiquidity` e dívidas ativas geradas pelo SSOT. Isso aprimorou a acurácia, refletindo valores centavos-precisos como `R$ 230,95` em vez de um teto genérico imposto pela UI.

## 5. Fechamento de Mês e Consistência na API
- **O Problema:** Diferentes APIs (ex: `/api/financial-state` e `/api/month-closing`) computavam a fotografia financeira de maneiras distintas.
- **A Solução:** As rotas agora delegam toda a construção do `buildFinancialState` e validações para o SSOT. Adicionamos validação Regex forte de `YYYY-MM` no endpoint de fechamento de mês, prevenindo crashes devido a formatos de referência incorretos.

## 6. Blindagem de Estabilidade de E2E (UI Modals)
- **O Problema:** O contexto não enviava o mapeamento padrão de categorias nas fixtures iniciais de testes E2E, o que causava crash total (Cannot read properties of null) ao abrir o modal de novas transações (ex: `AddSubscriptionModal`).
- **A Solução:** Mock padrão (`categories`) garantido em todo ponto de entrada base do `financialState.ts` e testes estabilizados para não conflitarem com as renderizações reativas do React.

## 7. Adoção do Banco de Dados como SSOT Definitivo para Dívidas
- **O Problema:** O sistema tentava sobrescrever o valor real do limite utilizado (`balance_cents`) que vinha do banco de dados somando faturas estáticas. Quando o usuário adicionava transações retroativas, a dívida ficava travada em valores defasados, gerando um gap matemático real.
- **A Solução:** Removemos a sobreescrita forçada na API. Agora, a verdadeira Single Source of Truth para a dívida do cartão de crédito é o valor exato reportado pela tabela `accounts` no Supabase, garantindo alinhamento total e integridade imediata.

## 8. Dashboard "Resumo Consolidado" alinhado 100% à SSOT
- **O Problema:** A interface do painel consolidado ("MonthlyConsolidatedExcel") para projeções mensais continha uma lógica de *fallback* redundante. Isso causava uma série de bugs: (1) Reajustes manuais nas faturas reais (`INCOME`) eram ignorados; (2) Faturas já pagas (`PAID`) retornavam para a projeção de "Saídas", gerando dupla contabilização caso o pagamento já estivesse refletido na conta bancária.
- **A Solução:** Removemos o *fallback* de recálculo transacional para as faturas de cartão. O sistema de projeções do Dashboard agora confia inteiramente na tabela `credit_card_invoices` (via `liveInvoices`) filtrada rigorosamente para `OPEN` ou `CLOSED`, extraindo da SSOT o valor absoluto da fatura e apenas apensando transações puramente virtuais (ainda não geradas no banco) para cálculos de projeção futura.

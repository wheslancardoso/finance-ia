# ADR-005: Gestão de Exceções em Fluxos Recorrentes e Parcelados

**Status:** Proposto
**Data:** 13/05/2026

## Contexto
O usuário necessita de flexibilidade para modificar ocorrências específicas de uma regra recorrente (ex: pular o cabeleireiro em um mês específico) ou encerrar compromissos futuros sem perder o histórico passado. No sistema atual, a distinção entre `recurring_transactions` (Regras) e `transactions` (Fatos) permite uma gestão granular.

## Decisão
Implementaremos um sistema de exclusão triplo, otimizado para o modelo de projeção sob demanda:

### 1. Excluir Apenas Esta (Ocorrência Específica)
- **Mês Atual/Passado:** Se a transação já foi gerada, a exclusão da `transaction` física é suficiente. A regra pai permanece ativa.
- **Mês Futuro (Projeção):** Adicionaremos uma coluna `excluded_months` (Array de Strings, ex: `['2026-07']`) na tabela `recurring_transactions`. O motor de projeção (`AdvancedProjection`) filtrará essas datas.

### 2. Excluir Esta e Próximas (Encerramento)
- Atualizaremos o `status` da `recurring_transaction` para `inactive`.
- Definiremos uma `end_date` opcional para permitir que o histórico de projeção retroativa (Time Machine) ainda mostre que aquele valor existia antes da data X.

### 3. Excluir Todas (Limpeza Total)
- Deleção em cascata da `recurring_transaction` e todas as `transactions` vinculadas a ela.

### 4. Tratamento de Parcelados (Installments)
- Para compras parceladas, a exclusão de uma parcela no meio do caminho não alterará o número da parcela original (ex: 5/12), mas marcará aquela competência como "Isenta" para não impactar o saldo líquido.

## Consequências
- **Prós:** Mantém o banco de dados limpo (sem transações fantasmas no futuro remoto); fornece precisão histórica; alinhado com a UX de "Atrito Zero".
- **Contras:** Leve aumento de complexidade no motor de projeção para checar a lista de exclusões.

## UI/UX
Ao clicar em "Excluir" em um item recorrente, o modal apresentará as três opções de forma clara, com ícones distintos para cada nível de impacto.

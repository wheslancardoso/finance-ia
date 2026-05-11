# Próximo Passo: Histórico de Transações e Filtros

Após a conclusão das **Transferências entre Contas**, o próximo foco deve ser a navegação e auditoria de dados no histórico de transações.

## 🎯 Objetivo
Garantir que o usuário consiga encontrar, filtrar e auditar suas movimentações financeiras com precisão, validando a integridade da lista de transações.

## 📋 Atividades
1. **Infraestrutura**:
   - Injetar `data-testid` na barra de busca e nos filtros de categoria/conta em `TransactionsContent.tsx`.
   - Garantir que cada linha da transação tenha um ID único no DOM para facilitar a seleção.

2. **Testes E2E (`tests/transactions-audit.test.ts`)**:
   - **Busca**: Digitar um termo e validar se a lista filtra corretamente.
   - **Filtro de Conta**: Selecionar uma conta e verificar se apenas transações dela aparecem.
   - **Visualização de Detalhes**: Validar se o modal de edição abre com os dados corretos ao clicar em uma transação.

3. **Edição e Exclusão**:
   - Editar uma transação pontual e validar a persistência.
   - Excluir uma transação e validar a atualização automática do saldo da conta vinculada.

---
**Status Atual**: 5 fluxos principais 100% testados (Faturas, Assinaturas, Dashboard, Metas, Transferências).
**Próximo arquivo**: `tests/transactions-audit.test.ts`

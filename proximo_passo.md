# Próximo Passo: Transferências e Integridade de Contas

Após a conclusão bem-sucedida dos testes de **Metas (Goals)** e **Dashboard**, o próximo foco deve ser a movimentação de recursos entre diferentes contas e a validação do histórico de transações.

## 🎯 Objetivo
Garantir que transferências entre contas (ex: da Conta Corrente para Reserva) funcionem corretamente, atualizando ambos os saldos e gerando os registros de auditoria necessários.

## 📋 Atividades
1. **Infraestrutura**:
   - Injetar `data-testid` no componente de Transferência (se existir) ou criar o fluxo se for manual.
   - Adicionar mocks para a API de transferências em `financialMocks.ts`.

2. **Testes E2E (`tests/transfers.test.ts`)**:
   - Realizar transferência de valor X da Conta A para Conta B.
   - Validar que Saldo A = Saldo A - X.
   - Validar que Saldo B = Saldo B + X.
   - Verificar se a transação aparece na lista de transações recentes com o tipo correto.

3. **Validação de Estorno/Cancelamento**:
   - (Se aplicável) Excluir uma transferência e validar o retorno dos saldos ao estado original.

---
**Status Atual**: 4 fluxos principais 100% testados (Faturas, Assinaturas, Dashboard, Metas).
**Próximo arquivo**: `tests/transfers.test.ts`

# Próxima Implementação: Testes E2E de Metas e Gestão de Contas

## Objetivo
Implementar uma suíte de testes Playwright para os módulos de **Metas (Goals)** e **Contas (Accounts)**, seguindo o padrão determinístico estabelecido no módulo de transações.

## Diretrizes Técnicas
- **Padrão Seed-then-Navigate**: Sempre configurar o `mockState` em `tests/mocks/financialMocks.ts` antes de realizar a navegação `page.goto()`.
- **Mocks Requeridos**:
  - `GET /financial-state`: Deve refletir o impacto dos limites e aportes.
  - `POST /goals/contribute`: Simular o aporte em uma meta.
  - `POST /accounts/pay-invoice`: Simular o pagamento de fatura.

## Cenários de Teste

### 1. Gestão de Metas (Goals)
- **Visualização**: Garantir que o HUD de metas na Dashboard exibe o progresso correto baseado no mock.
- **Aporte**: 
  - Abrir o modal de detalhes da meta.
  - Realizar um aporte de R$ 100,00.
  - Verificar se a requisição foi feita com os dados corretos.
  - Validar se o HUD de "Sobra Livre" na Dashboard foi atualizado (diminuído pelo valor do aporte).

### 2. Gestão de Contas e Cartões (Accounts)
- **Limite Disponível**: Validar se o card de cartão de crédito exibe o limite correto (Total - Fatura Aberta).
- **Pagamento de Fatura**:
  - Abrir o fluxo de pagamento de fatura em uma conta de cartão.
  - Selecionar "Pagar Agora".
  - Verificar se a fatura transita para o estado "Paga" e o limite é restabelecido no mock/UI.

## Seletores de Referência (data-testid)
- `goal-card-[id]`
- `contribute-button`
- `goal-progress-bar`
- `account-card-[id]`
- `pay-invoice-button`
- `confirm-payment-button`
- `surplus-value` (Sobra Livre)

## Resultado Esperado
Uma nova suite `tests/financial-management.test.ts` que cubra os caminhos críticos acima, garantindo que a lógica de "Centro de Comando" (Dashboard) esteja sincronizada com as ações do usuário.

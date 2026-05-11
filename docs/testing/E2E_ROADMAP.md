# Roadmap de Testes E2E (Playwright)

Este documento descreve os fluxos de testes End-to-End implementados e o planejamento para futuras coberturas, garantindo a integridade da aplicação Finance IA.

## 🛠️ Infraestrutura Atual
- **Framework**: Playwright
- **Mocks**: Interceptação de API via `page.route` em `tests/mocks/financialMocks.ts`.
- **Estado**: Simulação de banco de dados e perfil de usuário injetados via `mockState`.

---

## ✅ Fluxos Implementados

### 1. Pagamento de Faturas (`tests/invoice-payment.test.ts`)
- **Cenários Cobertos**:
  - Pagamento total de fatura.
  - Pagamento parcial com ajuste de saldo.
  - Validação de saldo insuficiente.
  - Atualização em tempo real do limite do cartão.

### 2. Gestão de Fluxos Recorrentes / Assinaturas (`tests/subscriptions.test.ts`)
- **Cenários Cobertos**:
  - **Criação**: Cadastro de novos gastos fixos e receitas recorrentes.
  - **Edição**: Alteração de valores e descrições de assinaturas existentes.
  - **Status**: Pausar e reativar fluxos.
  - **Exclusão**: Remoção definitiva de recorrências com confirmação via modal.
  - **Sincronização**: Verificação do "Survival HUD" (Teto de Sobrevivência) após alterações.

### 3. Dashboard e Inteligência Financeira (`tests/dashboard.test.ts`)
- **Cenários Cobertos**:
  - **Métricas**: Validação do Health Score e Liquidez Real.
  - **Crise**: Ativação automática do "Modo Sobrevivência" e HUD de Salvação quando o caixa é negativo.
  - **Projeção**: Verificação do Teto de Sobrevivência (Saldo ao fim do mês).

### 4. Gestão de Ambições (Metas) (`tests/goals.test.ts`)
- **Cenários Cobertos**:
  - **Criação**: Cadastro de novos objetivos com valor alvo e inicial.
  - **Aporte**: Realização de depósitos em metas com atualização automática de saldo da conta e progresso.
  - **Exclusão**: Remoção de metas via detalhes.
  - **Recomendações**: Integração com o sistema de recomendações para abrir aporte rápido.

---

## 🚀 Fluxos Planejados (Próximas Etapas)

### 5. Transferências entre Contas
- **Objetivo**: Validar a integridade de saldos entre múltiplas contas.
- **Cenários**:
  - Transferência interna entre Conta Corrente e Investimentos.
  - Validação de histórico de transações após transferência.

### 6. Autenticação e Perfil
- **Objetivo**: Garantir a persistência e segurança do usuário.
- **Cenários**:
  - Troca de `user_id` e recarregamento de estado.
  - Persistência de configurações locais no LocalStorage.

### 7. Histórico de Transações e Filtros
- **Objetivo**: Garantir que a busca e filtros de transações funcionam.
- **Cenários**:
  - Busca por descrição.
  - Filtro por categoria.
  - Edição de transação pontual.

---

## 🚦 Critérios de Aceite para Novos Testes
- Todos os elementos interativos devem possuir `data-testid`.
- Testes devem ser independentes (uso de `beforeEach` para reset de estado).
- Uso obrigatório de `toContainText` para strings de moeda (resiliência a locale).
- Sucesso verificado por alterações visíveis na UI (HUD, Cards, Gráficos).

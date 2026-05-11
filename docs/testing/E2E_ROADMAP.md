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

---

## 🚀 Fluxos Planejados (Próximas Etapas)

### 3. Dashboard e Projeções Financeiras
- **Objetivo**: Garantir que as visualizações de gráficos e métricas refletem a realidade dos dados.
- **Cenários**:
  - Renderização do gráfico de evolução de patrimônio líquido.
  - Cálculo dinâmico do Health Score.
  - Alternância entre visões "Atual" e "Projetada".

### 4. Gestão de Metas (Goals)
- **Objetivo**: Validar o ciclo de vida de objetivos financeiros.
- **Cenários**:
  - Criação de meta com cálculo automático de prazo.
  - Aporte manual em metas existentes.
  - Visualização de progresso e recomendações de aporte.

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

---

## 🚦 Critérios de Aceite para Novos Testes
- Todos os elementos interativos devem possuir `data-testid`.
- Testes devem ser independentes (uso de `beforeEach` para reset de estado).
- Uso obrigatório de `toContainText` para strings de moeda (resiliência a locale).
- Sucesso verificado por alterações visíveis na UI (HUD, Cards, Gráficos).

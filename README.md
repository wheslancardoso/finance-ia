# Vesper Finance IA

Uma plataforma de inteligência financeira com estética **Premium Brutalist** focada em liquidez real e sobrevivência financeira.

## 🚀 Funcionalidades Principais

### 1. Dashboard em Tempo Real
- **Viagem no Tempo**: Projeção de patrimônio baseada em fluxos futuros e gastos agendados.
- **Liquidez Atual**: Visão clara do dinheiro disponível em contas não-crédito.
- **Sobra Livre**: Cálculo inteligente de quanto realmente sobra no mês após todos os compromissos.

### 2. Modo Crise (Survival HUD)
- **Teto de Sobrevivência**: Um HUD fixo que calcula seu limite de gastos diário e mensal baseado na sua renda e custos fixos.
- **Status de Saúde**: Indicadores visuais (Stable, Warning, Critical) baseados na porcentagem de renda comprometida.
- **Integração Automática**: Consome dados de `Fluxos Recorrentes` e `Gastos Manuais` para uma precisão absoluta.

### 3. Fluxos Recorrentes
- Gestão de assinaturas, aluguéis, salários e compromissos fixos.
- Diferenciação visual entre **Receitas Fixas** (Emerald) e **Gastos Fixos** (Violet).
- Edição simplificada e fallback inteligente de categorias.

## 🛠️ Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Estilização**: Tailwind CSS com Design System Brutalista
- **Banco de Dados**: Supabase (PostgreSQL + Auth)
- **Estado Global**: React Context API com Local-First Persistence (Dexie/LocalStorage)

## 📐 Lógica de Cálculo (Sobrevivência)
O **Teto de Sobrevivência** segue a fórmula:
`Teto = (Renda Base + Fluxos Recorrentes) + Sobras Passadas + Bicos Extras - (Custo Fixo + Gastos Recorrentes) - Dívida de Cartão - Gastos Variáveis do Mês`

## 🔄 Sincronização de Dados (Local-First)
A Vesper utiliza uma arquitetura de sincronização robusta para garantir performance e funcionamento offline:
1.  **API (PostgreSQL)**: Fonte da verdade remota.
2.  **Context API**: Gerencia o estado reativo da aplicação.
3.  **Dexie (IndexedDB)**: Cache local persistente que permite funcionamento offline e carregamento instantâneo.
4.  **Flow**: `API -> Context -> Dexie Sync`. O estado só é liberado para a UI após a confirmação da persistência local, evitando inconsistências.

## 🧪 Estratégia de Testes (Playwright)
Mantemos uma suíte de testes E2E determinística focada em fluxos financeiros críticos:
- **Seed-then-Navigate**: Mocks configurados antes da navegação para garantir estado previsível.
- **Isolamento de Estado**: Cada arquivo de teste utiliza um UUID único para evitar colisões no banco de dados local (IndexedDB).
- **Atestação de Impacto**: Validamos se mudanças em assinaturas ou novas metas refletem corretamente no cálculo do Teto de Sobrevivência.

Para rodar os testes:
```bash
npx playwright test
```

---
Desenvolvido com foco em precisão matemática e UX de alta performance.

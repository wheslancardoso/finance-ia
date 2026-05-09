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

---
Desenvolvido com foco em precisão matemática e UX de alta performance.

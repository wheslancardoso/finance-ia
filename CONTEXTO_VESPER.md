# 🌌 Vesper Finance | Centro de Comando

Este documento serve como o **Estado da Arte** do projeto para continuidade em outros ambientes.

## 🚀 Visão Geral
O Vesper não é um gerenciador financeiro comum; é uma ferramenta de **estratégia e baixa fricção**. O design segue a estética **Liquid Glass** (Glassmorphism, Neons, Transparências) e o fluxo de UX é inspirado na agilidade do **Nubank**.

## 🛠️ Stack Tecnológica
- **Framework:** Next.js 16 (App Router) + Turbopack.
- **Styling:** Tailwind CSS v4 (Sintaxe nativa com `@theme`).
- **Backend/DB:** Supabase (PostgreSQL + RLS).
- **Animações:** Framer Motion (Transições fluidas e micro-interações).
- **Datas:** `date-fns` (Motor de projeções e parcelamentos).

## 💎 Funcionalidades Implementadas

### 1. Centro de Comando (Dashboard)
- **Sobra Livre:** Cálculo em tempo real de quanto sobrará no mês após pagar todas as contas fixas e orçamentos planejados.
- **Viagem no Tempo:** Slider que projeta o saldo até **365 dias** no futuro.
- **Radar de Dívidas:** Identificação automática da data de término do último parcelamento.

### 2. Gestão de Ativos e Crédito
- **Contas:** Suporte a Corrente, Investimento, Dinheiro e Cartão de Crédito.
- **Crédito:** Gerenciamento de limites, dia de fechamento e dia de vencimento.
- **Visual:** Cards com barras de progresso de limite e cores customizáveis.

### 3. Motor de Transações
- **Fricção Zero:** Modais otimizados para poucos cliques.
- **Parcelamento Inteligente:** Seletor de 1x a 12x com cálculo de valor por parcela e data de término em tempo real.
- **Assinaturas:** Página dedicada para gerenciar custos fixos (`/subscriptions`), permitindo pausar/ativar serviços.

### 4. Estética Premium
- **Liquid Glass:** Backgrounds dinâmicos, blur intenso e bordas de cristal.
- **Custom Scrollbars:** Barras de rolagem ultra-finas e discretas integradas ao tema.

## 🗄️ Estrutura do Banco (Supabase)
As migrações principais estão na pasta `scratch/`:
- `migration_credit_cards.sql`: Campos de limite e datas de fatura.
- `migration_recurring.sql`: Tabela de assinaturas e contas fixas.
- `migration_budgets.sql`: Sistema de orçamentos por categoria.

## 🔑 Variáveis de Ambiente Necessárias
No arquivo `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=seu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_key
```

## 🎯 Próximos Passos Sugeridos
1. **IA de Categorização:** Integrar vLLM para classificar gastos automaticamente via descrição.
2. **Integração WhatsApp:** Conectar via n8n/Evolution API para lançamentos por voz/texto.
3. **Relatórios de Longo Prazo:** Gráficos de evolução patrimonial baseados na Viagem no Tempo.

---
*Vesper Finance - Construído para quem busca clareza absoluta.*

# 🌌 Manifesto Vesper Finance | Centro de Comando

O Vesper não é um app de contabilidade; é uma ferramenta de **estratégia financeira de baixa fricção**. Este documento alinha as funcionalidades e a filosofia do projeto para garantir que ele permaneça prático, fluido e útil, servindo como guia mestre para a versão Web e o futuro port Android.

---

## 💎 Filosofia de Design: "Liquid Glass"
*   **Fricção Zero:** Se leva mais de 5 segundos para registrar algo, o fluxo está errado.
*   **Visual Imersivo:** Glassmorphism, Neons, Blur intenso e micro-animações. O dinheiro deve parecer vivo.
*   **Foco no Futuro:** O passado é apenas histórico; o Vesper foca em quanto você terá amanhã.
*   **Contextual:** O app muda de cor e brilho com base no estado financeiro (verde/violeta/vermelho).

---

## 🚀 Os 4 Pilares de Funcionalidade (Visão Geral)

### 1. Centro de Comando (Dashboard Estratégico)
*   **Sobra Livre:** O número mais importante. Cálculo em tempo real: `(Saldo Atual + Entradas Previstas) - (Saídas Previstas + Metas)`.
*   **Visão de Futuro (Month Navigator):** Navegação por meses para projetar o saldo e patrimônio líquido baseado em fluxos recorrentes, orçamentos e parcelamentos.
*   **Radar de Status:** Visualização rápida de cartões (limite comprometido) e metas (progresso visual).

### 2. Modal Universal (Entrada Rápida)
*   **Single Door:** Um único ponto de entrada para Saídas, Entradas e Transferências.
*   **Inteligência de Parcelas:** Cálculo instantâneo de fim de dívida e valor por parcela.
*   **Aparência:** Estilo "Glass" limpo, sem spinners nativos de input, focado em velocidade de preenchimento.

### 3. Fluxo de Renda e Gastos Recorrentes
*   **Recorrência Inteligente:** Unificação de Salários (Income) e Contas Fixas/Assinaturas (Expense).
*   **Previsibilidade:** O sistema assume que esses valores ocorrerão e já os abate/soma no Time Travel automaticamente.
*   **Meta de Ganho:** Seção para definir objetivos de renda (Fixo + Variável).

### 4. Fábrica de Sonhos (Gestão de Objetivos)
*   **Lifestyle Goals:** Em vez de "Poupança", focamos em "Sonhos" (Carro, Viagem, Reserva).
*   **Aportes Dinâmicos:** Possibilidade de "alimentar" a meta com um clique, vendo o progresso imediato.
*   **Comprometimento:** O valor guardado em metas afeta a Sobra Livre, tratando o sonho como um "gasto obrigatório" para o futuro.

---

## 🛠️ Detalhamento Técnico (Blueprint Android)

### 1. Engine de Contas & Cartões
*   **Saldo Real:** Gerenciado por Triggers no DB para precisão absoluta.
*   **Lógica de Faturas:** Identificação automática da fatura aberta via `closing_day`.
*   **Filtros por Conta:** Sistema de Tabs no histórico para isolar fluxos de cartões específicos.

### 2. Sincronização & Performance
*   **Local-First (Dexie):** Persistência no IndexedDB para uso offline e latência zero na abertura de modais.
*   **Global Cache:** `FinancialDataContext` centraliza todas as contas e categorias com expiração inteligente.

### 3. Parcelamento & Histórico
*   **Timeline de Parcelas:** Visualização em modal de toda a série de pagamentos futuros de uma compra.
*   **Exclusão em Cascata:** Opção de deletar uma parcela única ou toda a série recorrente.

---

## ⚡ Stack Tecnológica
*   **Web:** Next.js 16 + Tailwind v4 + Framer Motion + Dexie.js.
*   **Backend:** Supabase (Auth, PostgreSQL, Realtime, Triggers).
*   **Android (Alvo):** Kotlin + Jetpack Compose + Room (Local DB) + Supabase SDK.

---

## ⚡ Ajustes Recentes (Maio/2026)
*   **Invoice-First Grouping**: No histórico de transações, cartões de crédito agora são agrupados por mês de fatura (ex: "Fatura de Maio") em vez de data civil, garantindo que compras feitas no dia do fechamento apareçam no mês correto de cobrança.
*   **Credit Card Logic Refinement**: Implementada a regra de fechamento `>= closing_day` para atribuição automática de faturas e rollover de HUD baseado no mês vigente.
*   **Billing Cycle Dashboard**: O card de conta agora alterna automaticamente entre "Fatura Aberta" e "Fatura Fechada" baseado na data atual, exibindo o status relevante para o momento do usuário.
*   **Invoice Payment System**: Adicionado modal de pagamento de fatura com fluxos de "Pagar Agora" (cria transação de débito) e "Já Paguei" (apenas libera o limite marcando as transações como pagas).
*   **Planned Expenses Fix**: O cálculo de "Gastos Previstos" no Dashboard agora soma: faturas fechadas + faturas abertas (não pagas) + parcelas futuras do mês + recorrentes. A "Sobra Livre" é `Liquidez Atual - Gastos Previstos`. Dados vêm do `FinancialDataContext` (client-side) garantindo sincronia em tempo real.
*   **Cross-Page Sync**: O filtro de contas em `/transactions` agora exibe o valor correto da fatura (fechada ou aberta) com label dinâmico, sincronizado com `/accounts` via contexto compartilhado.
*   **UI/UX Refinement**: Refinamento do card de Recentes para não sobrepor a Timeline e implementação de Portais para modais, garantindo visibilidade total sobre o layout Glass.
*   **Future Vision Engine**: Substituição do Time Travel linear por um Navegador de Meses discreto, permitindo visualizar o estado final de cada mês futuro, incluindo projeções de orçamentos e receitas recorrentes.
*   **Net Worth & Salvation Goal**: Introdução da métrica de Patrimônio Líquido (Liquidez - Dívidas) e a "Meta de Salvação" no SurvivalHUD, focada em usuários que buscam sair do ciclo de endividamento.

---

## 🗺️ Roadmap de Implementação

### Fase 1: Fundação & Fricção Zero (CONCLUÍDA ✅)
- [x] Autenticação e Layout Base.
- [x] Modais de Transação e Histórico Filtrável.
- [x] Lógica de Faturas e Limites Dinâmicos.
- [x] Sincronização Local-First e Cache Global.

### Fase 2: O Centro de Comando (Foco Atual 🎯)
- [x] **Gestão de Metas**: Criação e Aportes básicos.
- [x] **Lógica de Sobra Livre**: Integração de faturas e gastos recorrentes no Dashboard.
- [x] **Visão de Futuro (Month Navigator)**: Navegador de meses para projeção de saldo futuro e fim de dívidas.

### Fase 3: Inteligência & Expansão
- [ ] **Relatórios de Evolução**: Mix de Renda e Evolução de Patrimônio.
- [ ] **Port Android**: Iniciar desenvolvimento do HUD mobile em Kotlin/Compose.

### Fase 4: Modo Crise & Recuperação (Recurso Avançado)
- [x] **Dashboard de Recuperação**: Implementar cálculo do "Patrimônio Líquido" e meta de quitação de dívidas.
- [x] **Teto de Sobrevivência**: Divisão inteligente da Sobra Livre em orçamentos semanais/diários base-zero.
- [ ] **Guardião de Compras (n8n + IA)**: Integrar etapa de avaliação e fricção no WhatsApp, onde a IA simula o impacto de um gasto variável antes de autorizar o registro.

### **5. Sistema de Pagamento de Faturas e Reconciliação Híbrida**
Para mitigar a fricção entre o gasto no cartão e a liquidação da fatura, a plataforma implementa um fluxo de pagamento em dois níveis:
*   **Pagar Agora (Débito Integrado):** Automatiza a criação de uma transação de despesa na conta corrente e, simultaneamente, marca todas as transações da fatura como pagas, liberando o limite.
*   **Já Paguei (Sincronização Manual):** Permite que o usuário reconcilie faturas pagas fora da plataforma (ex: débito automático no banco) sem duplicar a saída de caixa, focando apenas na liberação do limite e atualização do HUD de faturas.

---
*Vesper Finance - Construído para clareza absoluta e fricção zero.*

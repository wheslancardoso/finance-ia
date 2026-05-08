# 🌌 Manifesto Vesper Finance | Centro de Comando

O Vesper não é um app de contabilidade; é uma ferramenta de **estratégia financeira de baixa fricção**. Este documento alinha as funcionalidades e a filosofia do projeto para garantir que ele permaneça prático, fluido e útil, servindo como guia mestre para a versão Web e o futuro port Android.

---

## 💎 Filosofia de Design: "Liquid Glass"
*   **Fricção Zero:** Se leva mais de 5 segundos para registrar algo, o fluxo está errado.
*   **Visual Imersivo:** Glassmorphism, Neons, Blur intenso e micro-animações. O dinheiro deve parecer vivo.
*   **Foco no Futuro:** O passado é apenas histórico; o Vesper foca em quanto você terá amanhã.
*   **Contextual:** O app muda de cor e brilho com base no estado financeiro (verde/violeta/vermelho).

---

## 🚀 Funcionalidades Implementadas (Blueprint para Android)

### 1. Gestão de Contas & Cartões (Engine Central)
*   **Contas Correntes:** Saldo real sincronizado via Supabase Triggers.
*   **Cartões de Crédito Inteligentes:**
    *   Gestão de limite total vs. disponível.
    *   **Cálculo Automático de Fatura:** Lógica baseada em `closing_day` e `due_day`. O sistema identifica automaticamente a fatura aberta no momento (UTC) e soma as transações correspondentes.
*   **Filtros Dinâmicos:** Interface estilo "Tabs" no histórico para isolar transações por conta específica com um clique.

### 2. Fluxo de Transações (Entrada Rápida)
*   **Single Door Entry:** Modal universal para Entradas, Saídas e Transferências.
*   **Parcelamento Nativo:**
    *   Projeção automática de datas para parcelas futuras.
    *   **Installment Timeline:** Visualização em modal de toda a série de parcelas de uma compra.
    *   Exclusão inteligente (apenas uma parcela ou a série completa).
*   **Categorias Inteligentes:** Sistema de categorias globais (semeadas automaticamente) e customizadas por família.

### 3. Sincronização & Performance (Local-First)
*   **Persistência Offline (Dexie.js):** Contas e categorias são armazenadas localmente no IndexedDB.
*   **Cache Estratégico:** Os dados financeiros são cacheados globalmente (FinancialDataContext), garantindo que modais e dashboards carreguem sem spinners.
*   **Sincronização em Background:** O app prioriza a UI local e sincroniza com o Supabase de forma transparente.

### 4. Centro de Comando (Dashboard)
*   **Quick Sync:** Botão de sincronização rápida para ajuste de saldo manual com log automático.
*   **Status de Cartões:** Visualização rápida do comprometimento do limite.

---

## 🛠️ Stack Tecnológica
*   **Web:** Next.js 16 (App Router) + Tailwind v4 + Framer Motion.
*   **Local DB:** Dexie.js (IndexedDB).
*   **Backend:** Supabase (Auth, PostgreSQL, Realtime, Triggers).
*   **Android (Futuro):** Kotlin + Jetpack Compose + Room (Local DB) + Retrofit/Supabase SDK.

---

## ⚡ Ajustes Recentes (Maio/2026)
*   **Account Filter Strip**: Implementação de seletor de contas horizontal no histórico com indicadores de saldo.
*   **Dynamic Invoice Logic**: Correção do cálculo de faturas para respeitar o fuso horário e dias de fechamento.
*   **Automatic Category Seeding**: Novos usuários ganham automaticamente um set de categorias (Salário, Alimentação, Lazer, etc).
*   **Z-Index & Layout Fixes**: Estilização de inputs de data nativos e correções de sobreposição em modais "Glass".

---

## 🗺️ Roadmap de Implementação (Ordem de Batalha)

### Fase 1: Fundação & Fricção Zero (CONCLUÍDA ✅)
- [x] Autenticação e Layout Base (AppShell).
- [x] Modais de Transação e Histórico Filtrável.
- [x] Sistema de Cache Global e Persistência Local-First.
- [x] Lógica de Faturas de Cartão e Limites Dinâmicos.

### Fase 2: O Centro de Comando (Foco Atual 🎯)
- [ ] **Fábrica de Sonhos (Goals)**: Finalizar o módulo de metas com aportes e retiradas afetando o saldo livre.
- [ ] **Lógica de Sobra Livre**: Implementar o cálculo real `(Saldo + Entradas) - (Saídas + Metas)`.
- [ ] **Time Travel (Slider)**: Slider para projeção de saldo futuro baseado em fluxos recorrentes.

### Fase 3: Inteligência & Expansão
- [ ] **Relatórios de Evolução**: Mix de Renda e Evolução de Patrimônio.
- [ ] **Port Android**: Iniciar desenvolvimento do HUD mobile em Kotlin/Compose.

---
*Vesper Finance - Construído para clareza absoluta e fricção zero.*

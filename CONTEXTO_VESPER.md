# 🌌 Manifesto Vesper Finance | Centro de Comando

O Vesper não é um app de contabilidade; é uma ferramenta de **estratégia financeira de baixa fricção**. Este documento alinha as funcionalidades e a filosofia do projeto para garantir que ele permaneça prático, fluido e útil.

---

## 💎 Filosofia de Design: "Liquid Glass"
*   **Fricção Zero:** Se leva mais de 5 segundos para registrar algo, o fluxo está errado.
*   **Visual Imersivo:** Glassmorphism, Neons, Blur intenso e micro-animações. O dinheiro deve parecer vivo.
*   **Foco no Futuro:** O passado é apenas histórico; o Vesper foca em quanto você terá amanhã.

---

## 🚀 Os 4 Pilares de Funcionalidade

### 1. Centro de Comando (Dashboard Estratégico)
*   **Sobra Livre:** O número mais importante. Cálculo em tempo real: `(Saldo Atual + Entradas Previstas) - (Saídas Previstas + Orçamentos)`.
*   **Time Travel (Viagem no Tempo):** Slider dinâmico para projetar o saldo em até 365 dias.
*   **Radar de Status:** Visualização rápida de cartões (limite) e metas (progresso).

### 2. Modal Universal (Entrada Rápida)
*   **Single Door:** Um único ponto de entrada para Saídas, Entradas e Parcelamentos.
*   **Inteligência de Parcelas:** Cálculo instantâneo de fim de dívida e valor por parcela.
*   **Aparência:** Estilo "Glass" limpo, sem spinners nativos de input (scrollbar de números escondida).

### 3. Fluxo de Renda e Gastos Recorrentes
*   **Recorrência Inteligente:** Unificação de Salários (Income) e Contas Fixas/Assinaturas (Expense).
*   **Previsibilidade:** O sistema assume que esses valores ocorrerão e já os abate/soma no Time Travel automaticamente.
*   **Configuração de Renda:** Seção para definir "Meta de Ganho" (Fixo + Variável).

### 4. Fábrica de Sonhos (Gestão de Objetivos)
*   **Lifestyle Goals:** Em vez de "Poupança", focamos em "Sonhos" (Carro, Viagem, Reserva).
*   **Integração de Saldo:** O valor guardado em metas pode ser visualizado como "Comprometido", afetando a Sobra Livre.

---

## 🛠️ Stack Tecnológica & Arquitetura
*   **Frontend:** Next.js 16 (App Router) + Turbopack + Tailwind v4.
*   **Database (Local-First):** Dexie.js (IndexedDB) para persistência offline e latência zero.
*   **Backend:** Supabase (Auth + DB + RLS para compartilhamento familiar).
*   **Interações:** Framer Motion para transições de estado de fluxo.

---

## ⚡ Funcionalidades Recentes (Maio/2026)
*   **Financial Data Cache**: Implementação de cache global para contas e categorias (10 min). Modais abrem instantaneamente.
*   **Transaction Timeline**: Linha do tempo vertical estilo "Liquid Glass" com agrupamento cronológico e ícones dinâmicos.
*   **Transaction Time**: Suporte a horário nas transações para ordenação precisa.
*   **Auto-Sync (DB Triggers)**: Atualização automática de saldos de contas via Gatilhos no Supabase (Insert/Update/Delete).

---

## 🗺️ Roadmap de Implementação (Ordem de Batalha)

### Fase 1: Fundação & Fricção Zero (CONCLUÍDA ✅)
- [x] Autenticação e Layout Base (AppShell).
- [x] Modais de Transação, Assinatura e Metas com Design Liquid Glass.
- [x] Timeline Cronológica Dinâmica.
- [x] Sistema de Cache Global e Persistência Local-First (Dexie).

### Fase 2: O Centro de Comando (Foco Atual 🎯)
- [ ] **Lógica de Sobra Livre**: Implementar o cálculo real `(Saldo + Entradas) - (Saídas + Metas)` no Dashboard.
- [ ] **Projeção de Fluxo**: Integrar a página de Assinaturas/Fluxos para gerar transações automáticas futuras.
- [ ] **Interface de Cartão**: Exibir faturas (fechamento/vencimento) com base no limite disponível.

### Fase 3: Inteligência & Expansão
- [ ] **Relatórios de Evolução**: Gráficos de barra de Mix de Renda e Evolução de Patrimônio.
- [ ] **Integração n8n/IA**: Automação de importação de extratos e categorização inteligente.

---
*Vesper Finance - Construído para clareza absoluta e fricção zero.*

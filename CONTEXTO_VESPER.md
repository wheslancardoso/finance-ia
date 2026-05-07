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
*   **Backend:** Supabase (Auth + DB + RLS para compartilhamento familiar).
*   **Interações:** Framer Motion para transições de estado de fluxo.

---

## 🗺️ Roadmap de Implementação (Ordem de Batalha)

### Fase 1: Ajustes de Fluxo (Atual)
- [x] Correção de Autenticação (Login/Signup explícito).
- [x] Padronização Visual de Inputs (Sem spinners, tabular-nums).
- [ ] **Ajuste do Modal Universal:** Garantir que Entradas e Saídas funcionem com a mesma fluidez.

### Fase 2: Centro de Configurações & Renda
- [ ] **Configurações:** Tela para gerenciar Categorias, Grupo Familiar e **Meta de Renda**.
- [ ] **Fluxo Recorrente:** Expandir a página de Assinaturas para incluir Projeção de Salário.

### Fase 3: Inteligência & Relatórios
- [ ] **Relatórios de Evolução:** Gráficos de Mix de Renda e Evolução Patrimonial.
- [ ] **Integração IA:** Categorização automática via vLLM.

---
*Vesper Finance - Construído para clareza absoluta e fricção zero.*

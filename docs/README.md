# 🗺️ Mapa Mestre de Documentação: Vesper Finance

> Este documento serve como o índice central e guia de progresso para a documentação completa do projeto.

---

## 🚦 Status da Documentação
- [x] **Contexto do Sistema (Master)** `(Concluído)`
- [x] **01. Visão Geral e Negócio** `(Concluído)`
- [x] **02. Arquitetura do Sistema** `(Concluído)`
- [x] **03. Motor Financeiro (O Algoritmo)** `(Concluído)`
- [x] **04. Infraestrutura e Persistência** `(Concluído)`
- [x] **05. Interface e Design System** `(Concluído)`
- [x] **06. Estratégia de Testes e Qualidade** `(Concluído)`
- [x] **07. Guia de Onboarding e Deployment** `(Concluído)`
- [x] **08. Gamificação Brutalista de Metas** `(Concluído)`

---

## 📑 Seções Detalhadas

### 🗺️ [Contexto do Sistema (Master)](./contexto_sistema.md)
*   **Conceito & Proposta**: De reativo (diário de gastos) a ativo e preditivo.
*   **Problemas Resolvidos**: Falsa sensação de riqueza e inércia das planilhas estáticas.
*   **Como Funciona**: Time Machine, Liquidez Líquida Real e precisão centesimal.
*   **Diferenciais**: Unified Survival HUD, Simulador de Impacto (Spending Simulator), Saída de Dívida.
*   **Gamificação Brutalista**: Escudo de Liquidez, Tiers de Antifragilidade, Lockout de Metas.
*   **Arquitetura**: Camadas desacopladas (Clean/Hexagonal) e Offline-First (Dexie.js + Supabase).

### 1. [Visão Geral e Negócio](./01_overview.md)
*   Missão do Vesper Finance.
*   Diferencial: Gestão Reativa vs. Proativa.
*   Definição de Modos de Saúde (Saudável, Sobrevivência, Crise).

### 2. [Arquitetura do Sistema](./02_architecture.md)
*   Arquitetura em Camadas (Domain, Application, Infrastructure, Presentation).
*   Injeção de Dependência e desacoplamento.
*   Registro de Decisões Arquiteturais (ADRs).

### 3. [Motor Financeiro](./03_financial_engine.md)
*   Lógica de Projeção Acumulada (Time Machine).
*   Cálculo de Liquidez Líquida vs. Bruta.
*   Algoritmo de Saída de Dívida (Debt Exit Strategy).
*   Simulador de Impacto de Gasto.

### 4. [Infraestrutura e Persistência](./04_infrastructure.md)
*   Integração com Supabase (Auth e Database).
*   Estratégia de Cache Local com Dexie.js (Offline-first).
*   Sincronização de Estado Financeiro.

### 5. [Interface e Design System](./05_interface.md)
*   Princípios de Design Premium (Dark Mode, Glassmorphism).
*   Componentes Inteligentes (UnifiedSurvivalHeader, BillCommitmentCard).
*   Responsividade e UX Mobile.

### 6. [Testes e Qualidade](./06_testing.md)
*   Pirâmide de Testes no Vesper.
*   E2E com Playwright: Padrão Page Object Model (POM).
*   Mocking de dados financeiros para testes determinísticos.

### 7. [Onboarding e Operações](./07_operations.md)
*   Configuração do ambiente local (.env).
*   Scripts de build e deploy.
*   Manutenção de Migrações.

### 8. [Gamificação Brutalista de Metas](./08_goals_gamification.md)
*   Tiers de Antifragilidade e Escudo de Liquidez.
*   Mecânicas de Lockout de Metas em Crise e Streaks.
*   Modelagem de banco de dados e persistência.

---

## 🛠️ Ferramentas Sugeridas para Visualização
Para transformar estes arquivos em uma base de conhecimento interativa:
- **Mermaid.js**: Para diagramas de fluxo e arquitetura dentro dos .md.
- **Nextra / Docusaurus**: Para gerar um site estático de documentação.
- **Typedoc**: Para gerar documentação automática de funções TS.

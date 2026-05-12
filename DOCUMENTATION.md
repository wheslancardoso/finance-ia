# 📖 Finance-IA: Documentação Mestre (System Map)

Este documento contém o mapeamento completo do ecossistema **Finance-IA**, abordando desde a visão de negócio até os detalhes técnicos de implementação.

---

## 🎯 1. Visão Geral e Propósito
O Finance-IA não é apenas um gerenciador financeiro; é um **Motor de Inteligência de Sobrevivência e Crescimento**. O diferencial do sistema é a capacidade de detectar o "Ciclo de Dívida" e forçar o usuário a priorizar a liquidez real sobre o consumo.

### Funcionalidades Principais:
- **Dashboard em Tempo Real:** Visão consolidada de saldo, saúde financeira e progresso mensal.
- **Survival HUD:** Interface dinâmica que muda de cor (Verde/Vermelho) e comportamento baseada na liquidez líquida.
- **Gestão de Metas Inteligentes:** Sistema que recomenda pausar ou acelerar aportes com base no risco de endividamento.
- **Fluxos Recorrentes:** Controle de assinaturas e despesas fixas com impacto projetado no caixa.
- **Autenticação Síncrona:** Sistema de mock para testes e segurança de dados.

---

## 🏗️ 2. Arquitetura Técnica (Clean Architecture)
O projeto segue rigorosamente a separação de preocupações em camadas:

### 📂 `src/domain/` (O Coração)
- **O que faz:** Regras de negócio puras e interfaces. Sem dependências externas.
- **Lógica Central:** `financial-logic.ts` — Cálculos de liquidez e projeções.
- **Testes:** Cobertura via `Vitest`.

### 📂 `src/infrastructure/` (Ferramentas)
- **O que faz:** Implementações concretas (Supabase, APIs, Email).

### 📂 `src/presentation/` (Interface)
- **O que faz:** Componentes React, Next.js e Framer Motion.
- **Aesthetics:** Design Premium Dark Mode.

---

## 🛡️ 3. Infraestrutura de Qualidade (Testes)
O sistema possui blindagem em três níveis:
1. **Unidade (Vitest):** Precisão matemática nos cálculos.
2. **E2E (Playwright Desktop):** Fluxos de usuário completos.
3. **E2E (Playwright Mobile):** Responsividade e UX Mobile validada.

---

## 🗺️ 4. Guia de Arquivos e Pastas
- `src/app/`: Rotas Next.js.
- `src/components/`: Componentes visuais.
- `src/context/`: Estado global da aplicação.
- `src/hooks/`: Lógica de interface reutilizável.
- `tests/`: Suíte completa de testes.

---

> [!TIP]
> Para manter esta documentação viva, recomenda-se o uso de **Storybook** para componentes visuais e **TypeDoc** para a lógica técnica.

# 🌟 Visão Geral: Vesper Finance

> "Não apenas conte seu dinheiro; faça seu dinheiro contar uma história sobre o seu futuro."

O **Vesper Finance** é uma plataforma de inteligência financeira pessoal projetada para transformar a gestão passiva (registrar o que já aconteceu) em uma gestão ativa e preditiva. Ele foi construído para usuários que buscam clareza total sobre sua saúde financeira atual e, principalmente, sobre o impacto de suas decisões no futuro.

---

## 🎯 Missão e Propósito

A maioria dos apps financeiros foca no passado (extratos). O Vesper foca no **amanhã**. Nossa missão é fornecer as ferramentas necessárias para que o usuário saiba, com precisão matemática, se ele pode ou não realizar um gasto hoje sem comprometer sua sobrevivência ou seus objetivos daqui a seis meses.

---

## 💎 Pilares Fundamentais

### 1. A Time Machine (Viagem no Tempo)
Diferente de uma planilha estática, o Vesper utiliza um motor de projeção acumulada. Ao navegar pelos meses futuros, o sistema recalcula automaticamente saldos, dívidas e liquidez, considerando:
*   Transações recorrentes (assinaturas/salários).
*   Parcelamentos de cartão de crédito.
*   Aportes planejados em metas.

### 2. Liquidez Líquida (O Valor Real)
No Vesper, o saldo bancário é apenas uma parte da história. O foco está na **Liquidez Líquida**: 
> `Liquidez = Saldo Total - Dívidas Consolidadas (Faturas de cartão + Parcelamentos)`
Isso evita a "falsa sensação de riqueza" que ocorre quando o usuário tem dinheiro no banco, mas deve o dobro no cartão de crédito.

### 3. Modos de Saúde Financeira
O sistema se adapta visualmente e funcionalmente ao estado do usuário:
| Modo | Condição | Comportamento da UI |
|---|---|---|
| **🟢 Saudável** | Liquidez > 0 e Sobra Mensal OK | Foco em Metas e Investimentos. |
| **🟡 Sobrevivência** | Liquidez < 0, mas Sobra Mensal > 0 | Foco em quitar dívidas e reduzir gastos supérfluos. |
| **🔴 Crise** | Liquidez < 0 e Sobra Mensal < 0 | Ativa o "Teto Semanal de Oxigênio" para evitar colapso total. |

---

## 🚀 Funcionalidades Principais

*   **Unified Survival Header**: Um painel de controle central que mostra o "oxigênio" financeiro em tempo real.
*   **Spending Simulator**: Simulador de impacto que analisa se uma compra (à vista ou parcelada) atrasará a saída das dívidas ou o alcance de uma meta.
*   **Debt Exit Strategy**: Algoritmo que projeta a data exata em que o usuário sairá do ciclo de dívida negativa.
*   **Gestão de Metas (Ambições)**: Sistema de priorização de aportes baseado na sobra real de caixa.

---

## 🛠️ Filosofia de Engenharia

O projeto é guiado por três princípios técnicos:
1.  **Privacidade e Rapidez**: Utiliza uma arquitetura *Offline-first* com Dexie.js para que os dados fiquem disponíveis instantaneamente no navegador.
2.  **Precisão Cirúrgica**: Todos os cálculos financeiros são feitos em **centavos (inteiros)** para evitar erros de ponto flutuante típicos do JavaScript.
3.  **Blindagem de Código**: Uma suíte rigorosa de testes E2E (Playwright) garante que as projeções matemáticas nunca quebrem após uma atualização.

---

> [!TIP]
> O Vesper não é um app de "diário de gastos". É um simulador de vida financeira.

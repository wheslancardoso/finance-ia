# 🎨 Interface e Design System

A interface do Vesper Finance segue a filosofia **"Luxury Tech"**: uma estética premium, escura e minimalista, inspirada em aplicativos bancários de alta performance e painéis de controle industriais.

---

## 🌈 Paleta de Cores Semântica

As cores no Vesper não são apenas decorativas; elas comunicam o estado da "Time Machine" e a saúde financeira:

*   **🟣 Violeta (#8B5CF6)**: A cor principal da marca. Representa inteligência e a Time Machine.
*   **🟢 Esmeralda (#10B981)**: Representa liquidez positiva, metas alcançadas e segurança.
*   **🟡 Âmbar (#F59E0B)**: Alerta de "Modo Sobrevivência" (Liquidez negativa, mas recuperável).
*   **🔴 Vermelho (#EF4444)**: Alerta de "Modo Crise" (Ciclo de dívida insustentável).

---

## 🕯️ Estética Visual: Dark Mode & Glassmorphism

O app utiliza um fundo ultra-escuro (`#0d0d0d`) para permitir que os elementos de UI brilhem.
*   **Glassmorphism**: Cards utilizam fundos com baixa opacidade e `backdrop-blur` para criar profundidade.
*   **Gradients**: Bordas e sombras utilizam gradientes sutis para dar o efeito de "vidro premium".

---

## 🧱 Componentes Core (Anatomia)

### 1. Unified Survival Header
É o cérebro visual do Dashboard. Ele unifica três métricas em uma única visão:
*   **Liquidez Projetada**: O valor principal que muda conforme o usuário viaja no tempo.
*   **Status de Saúde**: Rótulo dinâmico (Saudável, Crise, Recuperação).
*   **Teto de Sobrevivência**: Um card de "oxigênio" que mostra quanto o usuário pode gastar por semana sem quebrar.

### 2. Bill Commitment Card
Focado em transparência de gastos futuros.
*   Divide os compromissos em **Cartões**, **Agendados** (fixos) e **Reservas** (orçamentos).
*   Utiliza barras de progresso para mostrar o comprometimento da renda em relação ao limite seguro.

### 3. Spending Simulator
Interface interativa que renderiza o impacto visual de um gasto antes de ele ser realizado.
*   Utiliza cores vibrantes para indicar se a simulação é **SEGURA** ou **PERIGOSA**.

---

## 🎭 Animações e Feedback

Utilizamos o **Framer Motion** para garantir que a interface pareça viva:
*   **Transitions**: Mudanças de página e abertura de modais são suaves (spring-based).
*   **Feedback de Projeção**: Ao mudar o mês na Time Machine, os valores numéricos sofrem animação de "contagem" para enfatizar que o cálculo foi atualizado.

---

## 📱 Mobile-First UX

Embora seja um Web App, o Vesper foi desenhado para parecer um App Nativo no celular:
*   **Bottom Navigation**: Barra inferior fixa para facilitar o uso com o polegar.
*   **Touch Targets**: Botões e inputs com áreas de clique generosas (mínimo 44px).
*   **Tabelas Responsivas**: Transformação automática de listas densas em cards empilhados em telas pequenas.

---

> [!TIP]
> **Design ProTip**: No Vesper, se um elemento não comunica uma informação financeira útil, ele deve ser simplificado ou removido. A estética serve à clareza.

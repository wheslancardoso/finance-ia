# PRD-009: Central de Inteligência Conversacional Vesper AI Copilot (Modo Jarvis)

Este documento de requisitos (PRD) especifica a criação do **Modo Jarvis (Modo Copiloto de IA)** integrado de forma cirúrgica e contextual no próprio Dashboard do Vesper Finance. Ao invés de uma página isolada, a inteligência artificial será um modo de exibição ativo no Dashboard que reage e sincroniza em tempo real com o mês selecionado na Time Machine (viagem temporal).

---

## 1. Visão Geral do Produto
O Vesper AI Copilot evolui de um chatbot flutuante passivo e de cartões de simulação estáticos isolados para uma **experiência integrada de Copiloto de IA**. O usuário ativa o "Modo Copiloto" no Dashboard e a tela transiciona de forma fluida para revelar o chat ao lado do Dashboard redimensionado, criando uma central unificada de tomada de decisão.

### Principais Diferenciais Inovadores:
1. **Sincronização Temporal (Time Machine Sync):** A IA conhece e responde dinamicamente com base no mês que o usuário está visualizando na Time Machine do Dashboard (ex: se o usuário navega para Junho/2026, a IA analisa e responde sobre as contas e déficit de Junho/2026).
2. **Layout Reativo Unificado (Split Mode):** O chat é revelado de forma imersiva e integrada na lateral do Dashboard, redimensionando o grid do painel para que o usuário possa interagir com a IA e assistir visualmente à atualização reativa dos seus indicadores (Liquidez, Metas e Oxigênio Semanal).
3. **Pílulas de Ação Conversacionais (Interactive Simulator Cards):** A IA gera simulações sugeridas (como um empréstimo ideal ou amortização rápida de cartões) que aparecem como cartões no histórico da conversa, permitindo que o usuário aplique aquela simulação no caixa do Dashboard com um único clique.

---

## 2. Requisitos Funcionais

### RF-01: Switch de Ativação do Modo Copiloto (Modo Jarvis)
*   Adicionar um botão de ativação premium em destaque no cabeçalho do Dashboard (`UnifiedSurvivalHeader.tsx`): **"🔮 Modo Copiloto"** (ou ícone Sparkles animado).
*   Ao ser clicado, ativa a propriedade `isCopilotActive` no estado do Dashboard.
*   **Transição de Layout (Framer Motion):** O grid do Dashboard se reorganiza de forma fluida e o painel de chat do Copilot se expande ocupando 30% a 35% da tela à direita (ou esquerda) de forma totalmente integrada, sem recarregar a página e sem perder a visualização ativa.

### RF-02: Conversação Inteligente Temporal (Time Machine Sync)
*   O chatbot recebe a data atualmente selecionada (`targetDate`) e o deslocamento de meses (`monthOffset`) do Dashboard.
*   Ao mudar o mês na Time Machine (navegar pelos meses futuros/passados), o Copilot atualiza seu escopo contextualmente.
*   **Contexto de Prompt do Gemini:** O payload enviado ao endpoint `/api/chat` receberá a variável `monthOffset`. A API classificará os dados de caixa e projeção simulada para aquele período específico para fornecer respostas extremamente precisas (ex: *"Vejo que em Junho/2026 você tem uma projeção de déficit de R$ 1.210,73 por conta da última parcela do notebook..."*).
*   Recomendar perguntas iniciais dinâmicas que variam de acordo com o mês selecionado (ex: em meses de liquidez crítica, propor corte de gastos; em meses de respiro, sugerir aceleração de metas).

### RF-03: Pílulas de Simulação Conversacional (Function Calling da UI)
*   Quando o usuário perguntar sobre compras, parcelamentos ou empréstimos na conversa, a IA inserirá metadados estruturados delimitados por `<vesper-simulation>...JSON...</vesper-simulation>` no texto de resposta.
*   A UI fará o parser seguro e renderizará um **Card de Simulação Interativo** integrado no balão de resposta da IA.
*   O card de simulação contará com botões rápidos:
    *   **"Simular no Dashboard":** Carrega aquela simulação recomendada pela IA diretamente nas simulações ativas do Dashboard, atualizando reativamente todos os saldos e o teto semanal de gastos diante dos olhos do usuário.
    *   **"Salvar como Meta" / "Agendar no Caixa":** Persiste o lançamento nas tabelas correspondentes via serviços do Vesper.

### RF-04: Persistência do Histórico do Chat
*   A conversa de chat e o histórico serão persistidos no `localStorage` associados ao usuário para manter as trocas de mensagens intactas ao alternar o modo ou recarregar a tela do Dashboard.
*   Um botão discreto de **"Limpar Histórico"** será fornecido no cabeçalho do chat.

---

## 3. Requisitos Não Funcionais e Design UI/UX

### Design Premium e Conexão de Estado
*   **Visual Glassmorphic Integrado:** O painel de chat do Modo Copiloto deve parecer parte nativa do Dashboard, utilizando fundos translúcidos de desfoque de fundo (`backdrop-blur-3xl`), bordas curvadas elegantes e sombreados profundos.
*   **Grid Fluido:** O Dashboard se ajusta graciosamente do layout de colunas convencional para o layout dividido (Split Grid) com redimensionamento responsivo para monitores grandes e telas menores. No mobile, o painel do Copilot se comportará como um slide-up modal em tela cheia que pode ser minimizado facilmente.

---

## 4. Arquitetura de Sincronização

```
[Mudar Mês no Dashboard] ──> Atualiza targetDate / monthOffset
                                      │
                                      ▼
                      Sincroniza Estado do Copiloto
                                      │
                                      ▼
[Enviar Mensagem] ──> Envia Prompt + Contexto Temporal do Mês Ativo
                                      │
                                      ▼
                       [Next.js API Route /api/chat]
                                      │
                                      ▼
  [Resposta com Tags de Simulação] ──> UI renderiza Card Interativo
                                      │
                                      ▼
  [Clique em 'Simular'] ──> Atualiza activeSimulations do Dashboard em Tempo Real!
```

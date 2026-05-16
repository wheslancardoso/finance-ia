# 🗺️ Vesper Finance: Contexto, Funcionamento e Diferenciais do Sistema

> "Não apenas conte seu dinheiro; faça seu dinheiro contar uma história sobre o seu futuro."

O **Vesper Finance** é uma plataforma disruptiva de inteligência financeira pessoal e preditiva. Diferente dos gerenciadores tradicionais de finanças que agem apenas como "diários de gastos" (reativos), o Vesper funciona como um **simulador de vida financeira (ativo e preditivo)**. Ele foi construído sob uma estética *Premium Brutalist* para usuários que demandam clareza absoluta sobre o impacto imediato e de longo prazo de cada decisão financeira.

---

## 📌 1. A Dor que o Vesper Resolve (O Problema)

Gerenciadores financeiros comuns falham porque focam no passado. Eles dizem ao usuário onde ele *gastou* dinheiro, mas não respondem à pergunta mais importante: **"Se eu comprar isto hoje, qual será o impacto real na minha vida daqui a seis meses?"**

As principais dores resolvidas pelo Vesper são:
1. **A Falsa Sensação de Riqueza**: O usuário vê R$ 5.000,00 no saldo bancário, mas ignora que possui R$ 6.000,00 em faturas futuras e parcelamentos no cartão de crédito.
2. **A Paralisia por Ansiedade Financeira**: A falta de clareza matemática sobre quando as dívidas terminarão ou quando uma meta será alcançada gera estresse constante.
3. **A Inércia das Planilhas Estáticas**: Planilhas manuais exigem disciplina extrema e não recalculam automaticamente o fluxo de caixa acumulado diante de cenários hipotéticos.

---

## ⚙️ 2. Como o Sistema Funciona (O Motor e a Mecânica)

O coração do Vesper está no seu **Motor de Projeção Dinâmica** e na sua abordagem matemática rigorosa.

```mermaid
graph TD
    A[Estado Atual: Saldo Real] --> B[Motor de Projeção: Time Machine]
    B --> C[Passo 1: Somar Rendas Ativas]
    B --> D[Passo 2: Subtrair Custos Fixos]
    B --> E[Passo 3: Deduzir Parcelas de Cartão]
    B --> F[Passo 4: Reservar Orçamentos Planejados]
    B --> G[Passo 5: Subtrair Aportes de Metas]
    G --> H[Projeção de Saldo Acumulado nos Meses Futuros]
    style A fill:#111,stroke:#fff,stroke-width:2px;
    style H fill:#10b981,stroke:#000,stroke-width:2px;
```

### 🕰️ A Máquina do Tempo (*Time Machine*)
Ao navegar pelos meses futuros, o Vesper não apenas replica valores. O algoritmo `calculateAdvancedProjection` realiza uma simulação acumulada mês a mês, considerando:
* **Transações Recorrentes**: Salários, assinaturas e despesas fixas.
* **Parcelamentos**: A alocação exata de parcelas futuras nos meses correspondentes.
* **Projeção de Orçamentos (Budgets)**: Bloqueio preventivo de verbas para categorias (ex: Alimentação), tratando esse dinheiro como "gasto" antes mesmo de ocorrer, blindando a mente do usuário.
* **Aportes Automatizados**: A destinação simulada de sobras para as metas ativas do usuário.

### 🛡️ Liquidez Líquida Real vs. Saldo Bancário
O Vesper ignora a ilusão do saldo em conta corrente. A métrica soberana é a **Liquidez Líquida Real**:

$$\text{Liquidez Líquida Real} = \text{Saldo Bancário Total} - \text{Dívidas Consolidadas (Faturas + Parcelas Futuras)}$$

Se a Liquidez Líquida é negativa, o usuário está tecnicamente gastando dinheiro do futuro, independentemente de quanto dinheiro tem na conta hoje.

### 🔢 Precisão Centesimal (Blindagem contra JavaScript Floats)
Para mitigar os conhecidos erros de precisão decimal de ponto flutuante do JavaScript (como `0.1 + 0.2 === 0.30000000000000004`), o Vesper processa **100% dos valores financeiros em centavos (inteiros)** em toda a camada de domínio e banco de dados.
* **Exemplo**: R$ 150,45 é armazenado e calculado como `15045`. A conversão ocorre puramente na camada de exibição da UI.

---

## 💎 3. Diferenciais Práticos (O que torna o Vesper único)

### 📊 A) Unified Survival HUD (Teto de Oxigênio)
Um painel de controle de alta densidade de informação que exibe o **Teto de Sobrevivência** — o oxigênio financeiro do usuário. Ele calcula o saldo projetado ao fim do mês atual e o distribui em três visualizações dinâmicas:
* **Modo Mês**: A sobra real projetada para o período.
* **Modo Semana**: O teto semanal para gastos variáveis.
* **Modo Dia**: O limite diário de oxigênio para garantir que o usuário chegue ao fim do mês com saldo positivo.

### 🔮 B) Spending Simulator (Simulador de Impacto)
Antes de efetuar qualquer gasto significativo, o usuário pode simular a compra (seja à vista ou parcelada).
* **À Vista**: Reduz instantaneamente a liquidez e recalcula o impacto nas metas e na data de saída das dívidas.
* **Parcelado**: Projeta a distribuição das parcelas nos meses futuros e alerta visualmente se a operação causará um colapso de liquidez (saldométrico abaixo de zero) em algum ponto da projeção.

### 📉 C) Debt Exit Strategy ("Data de Alforria")
Se o usuário possui Liquidez Líquida negativa, o sistema ativa automaticamente um algoritmo preditivo de resgate:

$$\text{Meses para Alforria} = \frac{|\text{Liquidez Líquida Atual}|}{\text{Sobra Mensal Livre (Renda - Custos Fixos - Budgets)}}$$

O sistema prevê a data exata em que o usuário retornará ao campo da liquidez positiva e reformula os estímulos visuais da interface de acordo com essa contagem regressiva.

---

## 🎮 4. Gamificação Brutalista & Resiliência Financeira

O Vesper rejeita as mecânicas infantis de gamificação (como badges coloridos e moedinhas digitais). O progresso do usuário é baseado na **Resiliência e Antifragilidade Real**.

### 🛡️ O Escudo de Liquidez (*Liquidity Armor*)
A saúde financeira é calculada pelo número de meses que o usuário consegue sobreviver caso perca sua fonte de renda hoje:

$$\text{Meses de Cobertura} = \frac{\text{Liquidez Líquida Real}}{\text{Custo Fixo Mensal}}$$

Com base nessa métrica, o usuário avança entre os **Tiers de Antifragilidade**:

| Nível (Tier) | Nome do Tier | Cobertura (Meses) | Comportamento e Estética da Interface |
| :--- | :--- | :--- | :--- |
| **Tier 0** | 💀 **Zona de Oxigênio (Modo Crise)** | Liquidez $< 0$ | Estética vermelha intermitente, HUD bloqueia novas metas de consumo e ativa o Lockout de Metas. |
| **Tier 1** | 🛡️ **Sobrevivente** | $0 \le \text{Meses} < 3$ | Estilo industrial cinza e violeta. Permite metas básicas, estimulando a reserva de curto prazo. |
| **Tier 2** | ⚡ **Imune** | $3 \le \text{Meses} < 6$ | Acentos esmeralda e neon. O HUD libera Ambições de Médio Prazo (viagens, aquisições médias). |
| **Tier 3** | 🔮 **Antifrágil** | $\text{Meses} \ge 6$ | Estética Premium Ouro e Obsidian. Desbloqueia simulações complexas de investimento a longo prazo. |

### 🔒 Algoritmo de Lockout (Congelamento de Ambições)
Em períodos de crise (Tier 0), o Vesper impede a autossabotagem do usuário.
* **Comportamento**: Todas as metas criadas pelo usuário que não pertençam à categoria `Fundo de Emergência` são **congeladas**.
* **Visual**: Os botões de aporte são travados e os cards recebem uma sobreposição com uma mensagem brutalista direta:
  > **⚠️ META CONGELADA**
  >
  > *Seu oxigênio financeiro está abaixo do nível crítico. O motor de simulação bloqueou aportes nesta meta para preservar sua sobrevivência.*

### ⚡ Streaks de Consistência e Sobrecarga de Dívida (*Card Overload*)
* **Multiplicador de Streak**: Premia consecutividade. Cada mês mantendo os gastos abaixo do Teto de Sobrevivência acumula multiplicadores (`x3 Months Saved`) que liberam temas visuais exclusivos (*Acid Obsidian*, *Cyberpunk Amber*).
* **Rachaduras Digitais (Card Overload)**: Se o endividamento do cartão ultrapassar 50% dos ativos líquidos, a interface CSS simula distorções/ruídos estáticos nos painéis do cartão de crédito, criando um desconforto psicológico visual que induz o usuário a pagar as pendências.

---

## 🔮 6. O Futuro do Vesper: Roadmap de Causalidade Financeira

O Vesper não foi concebido para ser "um app que possui muitas funções", mas sim **"um sistema operacional que entende consequências"**. O objetivo da evolução do motor do Vesper é maximizar a **percepção de causalidade financeira** — fazer com que o usuário compreenda com clareza clínica e matemática o efeito cascata de cada centavo gasto no seu futuro de curto, médio e longo prazo.

Abaixo está o roadmap estratégico de evolução preditiva, focado em impacto psicológico forte, alta utilidade prática e preservação da estética brutalista e limpa da plataforma:

### 🥇 FASE 1: Causalidade Imediata e Consequências Visuais

Esta fase foca em responder de forma instantânea e visualmente marcante às duas perguntas críticas da mente de qualquer usuário sob estresse financeiro: *"Quando eu vou me ferrar?"* e *"Qual o impacto exato desse gasto nas minhas ambições?"*.

#### 1. Heatmap Temporal de Colapso (Sutil & Complementar)
*   **Conceito**: Em vez de poluir a tela principal com gráficos complexos ou relatórios densos, o Vesper introduz uma régua de tempo linear discreta e extremamente sutil na área de simulação (como uma barra de status horizontal ou mini-esferas de LED coloridas).
*   **Funcionamento**: Esta régua projeta o "clima financeiro" dos meses futuros com base no fluxo de caixa acumulado:
    *   🟢 **Verde**: Liquidez sólida, ativos confortavelmente cobrindo metas e custos.
    *   🟡 **Amarelo**: Zona de atenção, liquidez estreita, menor cobertura de reserva.
    *   🔴 **Vermelho**: Zona crítica, liquidez perigosamente próxima de zero.
    *   🔥 **Fogo (Brutalista)**: Colapso de caixa. O mês exato em que o saldo acumulado se tornará negativo.
*   **Impacto Psicológico**: Responde diretamente a *"Quando?"* e não *"Quanto?"*, gerando urgência na escala correta sem comprometer o design minimalista e limpo da UI.

#### 2. Impact Radius (Efeito Cascata das Simulações)
*   **Conceito**: Converte a matemática financeira em consequências práticas de linguagem humana na área do *Spending Simulator*.
*   **Funcionamento**: Ao simular uma compra (ex: um notebook de R$ 5.000,00), o simulador calcula o "raio de impacto" e exibe um feed clínico de danos:
    *   `- Meta Viagem Japão adiada em +4 meses`
    *   `- Liquidity Armor (Reserva) reduzida de 5.2 para 3.8 meses de oxigênio`
    *   `- Mês de Setembro entra na zona amarela (alerta de caixa)`
    *   `- Relação dívida/ativo líquido sobe para 48%`
*   **Impacto Psicológico**: Rompe a barreira do "preço parcelado", mostrando que o custo real de um bem não é apenas o dinheiro, mas sim o atraso dos seus sonhos e a redução da sua imunidade contra crises.

#### 3. Timeline Viva (Narrativa de Eventos Financeiros)
*   **Conceito**: Substitui o clássico e tedioso extrato de banco por uma linha do tempo de eventos narrativos contínuos que contam a história operacional da vida financeira do usuário.
*   **Funcionamento**: Exibe movimentações como marcos de sistema (Logs de SO):
    *   `⚡ Renda principal detectada e alocada (Soberania Financeira reestabelecida)`
    *   `⚠️ Parcela de Cartão de Crédito pesada (> 30% da renda) cobrada`
    *   `🔒 Liquidez em queda crítica: Lockout ativado (Metas de Consumo Congeladas)`
    *   `🛡️ Aporte efetuado na Reserva de Emergência: Liquidity Armor subiu para Tier 2`
*   **Impacto Psicológico**: Dá ao usuário uma forte sensação de progresso, protagonismo e controle de narrativa. Cada atitude consciente se torna um evento heroico no log do sistema.

---

### 🥈 FASE 2: O Copiloto Psicológico (Análise Fria)

Esta fase foca em aprofundar a relação de longo prazo e retenção do usuário com o Vesper, agindo como um analista implacável que expõe padrões comportamentais sem julgamentos emotivos ou clichês corporativos de "finanças felizes".

#### 4. Shadow Future (O Vínculo com o Eu do Amanhã)
*   **Conceito**: Um alerta analítico sutil que conecta simulações de autossabotagem com o atraso de metas futuras.
*   **Funcionamento**: Em vez de usar alertas histéricos ou conselhos teatrais, o sistema emite feedbacks secos e precisos baseados em simulações que prejudicam o fluxo futuro:
    *   > *"Sua versão de Outubro perdeu estabilidade de caixa após esta simulação."*
    *   > *"Você adiou sua independência financeira de curto prazo em 63 dias."*
*   **Impacto Psicológico**: Cria um forte senso de responsabilidade com o "futuro eu", estimulando a gratificação tardia de maneira inteligente e intelectual.

#### 5. DNA Financeiro (Estatística Clínica de Comportamento)
*   **Conceito**: Mapeamento implacável e estatístico dos gatilhos de comportamento do usuário, expresso em linguagem puramente clínica e fria.
*   **Funcionamento**: O motor monitora a relação temporal de compras e saldo para detectar vícios de fluxo de caixa:
    *   > *"Padrão Clínico: Compras de consumo não planejadas aumentam 43% nas 72h subsequentes ao depósito da renda principal."*
    *   > *"Instabilidade Crônica: Histórico de aportes em metas de consumo sofre 80% de cancelamentos no terço final do mês devido a vazamento de caixa variável."*
*   **Impacto Psicológico**: Substitui chamadas infantis por dados brutos e verdades matemáticas inquestionáveis. O usuário não se sente julgado; ele se sente matematicamente mapeado, gerando uma retenção e dependência intelectual incomparáveis com a plataforma.

---

## 🛠️ 7. Arquitetura e Filosofia de Engenharia

O Vesper Finance foi projetado para ser indestrutível, rápido e focado em privacidade.

### 📐 Separação Estrita de Responsabilidades (Clean Architecture)
A estrutura de pastas garante que a lógica de negócios seja blindada de qualquer influência de frameworks de UI ou banco de dados:
* **Domain (`src/domain/`)**: Contém entidades puras e funções matemáticas estritas. **Zero dependências externas**.
* **Application (`src/application/`)**: Orquestradores e use cases que intermediam comandos entre UI e dados.
* **Infrastructure (`src/infrastructure/` / `src/services/`)**: Implementação física do banco de dados e autenticação (**Supabase**).
* **Presentation (`src/components/` / `src/app/`)**: Camada visual com componentes brutalistas reativos e controle de estado global via React Context API (`FinancialDataContext`).

### 💾 Offline-First com Sincronização Assíncrona
* O aplicativo funciona 100% offline utilizando **Dexie.js** para gerenciar um banco de dados local robusto (IndexedDB) no navegador do usuário.
* A persistência local garante latência zero em todas as projeções e simulações.
* Quando há conexão estável, o estado sincroniza silenciosamente com o **Supabase Database**, mantendo os dados seguros em múltiplos dispositivos.

### 🧪 Blindagem Matemática Contínua
A integridade das simulações é assegurada por uma bateria implacável de testes ponta a ponta (E2E) usando **Playwright** baseada em Page Object Model (POM), simulando cenários catastróficos para garantir que os cálculos do motor nunca quebrem após novas atualizações na plataforma.

---

> [!TIP]
> O Vesper Finance não é apenas um software para rastrear dinheiro. É uma ferramenta de soberania financeira e planejamento de vida.

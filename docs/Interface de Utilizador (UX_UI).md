# **Documentação de Interface de Utilizador e Experiência (UX/UI)**

**Tecnologia:** Flutter (Motor Impeller para renderização avançada de shaders e blur)

**Plataformas:** Mobile (iOS/Android) e Web

**Filosofia de Design:** Estética *Liquid Glass* (foco em materialidade, refração e profundidade), Maximalismo Funcional (rico visualmente, não-minimalista), Reforço Positivo e Regra dos 3 Segundos.

## **1\. Princípios Visuais e de Acessibilidade (Liquid Glass)**

* **Materialidade e Profundidade (Fugindo do Plano):** A interface abandona o design plano e adota a tridimensionalidade (Eixo Z). Os elementos principais são "cartões de vidro" translúcidos (efeito *frosted glass* / desfoque de fundo) que parecem flutuar sobre a tela. Bordas com reflexos especulares finos (como luz a bater em vidro) e sombras projetadas dinâmicas dão peso físico aos elementos.  
* **Cores de Fundo e Refração (Maximalismo Visual):** Em vez do clássico "tudo preto" minimalista, o fundo da aplicação deve conter gradientes vivos, dinâmicos e orgânicos (esferas de cores abstratas ou ondas que se movem subtilmente). Estes fundos coloridos *refratam* através dos cartões de vidro translúcidos, criando uma interface viva e altamente sofisticada.  
* **Iluminação de Feedback (Glow/Bloom):** O verde/azul usado para reforçar orçamentos saudáveis não é apenas uma cor chapada; ele emite um "brilho" (glow) por trás do vidro, como um LED suave. O vermelho (para situações críticas) deve ser usado com extrema cautela, emitindo um brilho de alerta em vez de cobrir a tela.  
* **Tipografia e Iconografia Rica:** Uso da fonte *SF Pro* ou similares. A iconografia afasta-se dos ícones de linha fina e abraça ícones ricos, detalhados e com texturas volumétricas (micro-3D ou esqueumorfismo moderno) para que cada categoria financeira pareça um objeto valioso e palpável.  
* **Feedback Tátil e Interativo:** Ao tocar num cartão de vidro, este deve afundar ligeiramente (física de mola) e o reflexo do vidro deve mudar de posição de acordo com o toque. Pequenas vibrações no telemóvel (Haptics) acompanham cada interação.  
* **Acessibilidade Universal no Vidro:** Para garantir que a transparência não prejudica a leitura, os textos principais terão um tratamento de contraste adaptativo e leve sombra projetada (drop shadow) para se destacarem sempre do fundo refratado.

## **2\. Mapa de Navegação (Sitemap Lógico)**

A navegação principal far-se-á através de uma *Floating Glass Bar* (Barra flutuante de vidro translúcido na parte inferior), afastada das bordas da tela, com 4 abas e 1 botão central saltado:

1. **Início (Dashboard)**  
2. **Carteira (Contas, Cartões e Assinaturas)**  
3. **\[ \+ \] (Ação Rápida de Inserção \- Botão de Cristal Colorido)**  
4. **Previsão (A Máquina do Tempo)**  
5. **Orçamentos (Metas e Família)**

## **3\. Detalhamento dos Ecrãs Principais (Wireframe Lógico)**

### **3.1. O *Dashboard* Inicial (A Regra dos 3 Segundos)**

O utilizador abre a app. O Face ID / Touch ID valida a entrada. A interface "acende-se" em camadas, desde o fundo colorido até aos cartões de vidro no topo.

* **Fundo de Tela (Background):** Formas abstratas em tons profundos de ametista, esmeralda ou safira movendo-se lentamente.  
* **Cartão Topo (O que interessa):** Um cartão de vidro proeminente com bordas brilhantes.  
  * Texto flutuante massivo: *"Pode gastar com segurança hoje: 45,00 €"* \* Subtítulo brilhante: *"O seu saldo real total é de 1.250,00 €"*.  
* **Centro da Ecrã (A IA a Falar):**  
  * O Card de Feedback Positivo não é uma caixa quadrada, mas sim um balão translúcido e orgânico. *"Ótimo trabalho\! Poupou 15% em alimentação esta semana."* \* As últimas transações aparecem como finas lâminas de vidro sobrepostas em "escadinha".  
* **Ação Recomendada (Card Inferior):**  
  * Um aviso proativo sobre faturas a fechar ou assinaturas a subir, com uma luz lateral chamando a atenção.

### **3.2. Aba de Previsão ("Máquina do Tempo")**

A experiência de ver o futuro financeiro através de lentes.

* **Interação de Deslizar em 3D:** O carrossel de meses não é plano. À medida que o utilizador desliza (swipe) para a direita (Maio, Junho, Julho), os meses futuros aproximam-se do ecrã a partir do fundo, como se atravessassem a tela de vidro.  
* **O Gráfico *Liquid*:** O gráfico de queda do saldo não é uma linha chata. É uma onda translúcida e tridimensional (como líquido dentro de um recipiente) que desce à medida que os meses passam e as faturas são deduzidas.

### **3.3. Aba de Carteira (Contas, Cartões e Assinaturas)**

O centro de comando patrimonial com estética hiper-realista.

* **Cartões de Crédito Físico-Digitais:** Os cartões cadastrados são representados com extremo realismo. Se o utilizador tem um cartão Nubank (Roxo), o cartão renderizado na tela reage ao giroscópio do telemóvel, alterando os reflexos metálicos da luz à medida que o utilizador inclina o aparelho.  
* **Modo Família / Casal:** Um *Switch* (interruptor) detalhado. Quando alternado para "Dinheiro do Casal", a paleta de luz do fundo da aplicação muda suavemente (ex: de um tom azul-gelo para um tom dourado quente), indicando instintivamente que o contexto mudou.

### **3.4. Fluxo de Inserção de Gasto (O Botão Central de Cristal)**

* **Abertura Fluida:** Ao tocar no botão central \[ \+ \], a tela principal desfoca dramaticamente (High Blur), e o ecrã de inserção sobrepõe-se como uma grande placa de vidro curvada.  
* **Teclado Numérico Volumétrico:** As teclas não são apenas números pintados. São "botões" que parecem cápsulas de vidro que afundam ao toque.  
* **Ícones de Categoria:** Ícones 3D detalhados flutuando acima do valor digitado, oferecendo uma experiência visual rica (ex: um pequeno copo de café 3D com vapor para a categoria "Cafés", em vez de um ícone de linha).

### **3.5. Aba de Orçamentos (Enquadramento Positivo)**

* **Esferas de Orçamento em vez de Barras:** Substituímos as tradicionais barras de progresso lineares (que lembram planilhas chatas) por "Esferas de Líquido" ou anéis luminosos de vidro.  
* **Física de Líquido:** O orçamento disponível é representado pelo líquido dentro da esfera. Quando o utilizador regista uma despesa, o nível do líquido desce com uma animação ondulante realista, mantendo o enquadramento positivo: *"Ainda tens todo este líquido/combustível para gastar de forma segura\!"*

## **4\. O Fluxo de Onboarding (Primeiro Uso)**

1. **Criação Rápida:** Sem fundos brancos sem graça. O utilizador é recebido por uma interface imersiva e vívida desde o primeiro segundo.  
2. **Setup Zero:** Utiliza taxonomia automática e foca as animações na permissão do Face ID. O cadeado abre-se com uma animação 3D metálica/vitrificada suave.  
3. **A Magia do n8n:** A app instiga o envio de uma mensagem de áudio pelo WhatsApp. Quando a transação entra no banco, o cartão de vidro da aplicação "pulsa" com luz para celebrar a primeira entrada automatizada.
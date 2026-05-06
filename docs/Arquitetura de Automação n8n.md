# **Documentação de Arquitetura de Automação e IA**

**Motor de Orquestração:** n8n (Node-based Workflow Automation)

**Canal de Mensageria:** WhatsApp (via Evolution API \- MVP)

**Modelos de IA:** OpenAI GPT-4o (Texto e Visão) e Whisper (Áudio)

## **1\. Visão Geral do Fluxo (Pipeline)**

O fluxo de automação atua como a ponte inteligente entre a interação informal do utilizador no WhatsApp e a rigidez do banco de dados PostgreSQL. O objetivo é receber dados não estruturados (mensagens de voz, fotografias de faturas, textos soltos) e convertê-los numa transação financeira atomizada em segundos.

## **2\. Camada de Receção e Segurança (Webhook Node)**

A porta de entrada do sistema é um Webhook configurado para receber os eventos (POST) da Evolution API sempre que uma mensagem chega ao WhatsApp associado.

### **2.1. Filtro Anti-Loop (Crucial)**

A Evolution API envia *todos* os eventos da sessão, incluindo as mensagens que o próprio robô enviou. Para evitar um *loop* infinito (onde o robô tenta processar a sua própria resposta), o primeiro nó lógico (If/Filter Node) deve executar a seguinte validação:

* **Condição:** {{ $json.body.key.fromMe }} \== false  
* Se true (foi o próprio sistema que enviou): Interrompe o fluxo de imediato.  
* Se false (foi o utilizador que enviou): Prossegue para processamento.

## **3\. Roteamento Multimodal (Switch / Router Node)**

Após a passagem pelo filtro de segurança, a mensagem é analisada para determinar a sua natureza (tipo de anexo ou texto). O fluxo divide-se em três ramificações distintas:

### **3.1. Ramo 1: Áudio (Voice Notes)**

1. **Download do Ficheiro:** O n8n faz o download do áudio baseando-se no mediaKey.  
2. **Transcrição (Whisper AI):** O ficheiro de áudio é enviado para o modelo *Whisper* da OpenAI, que converte a fala em texto bruto (ex: *"Acabei de gastar vinte e cinco euros no supermercado Pingo Doce usando o cartão de crédito"*).  
3. **Encaminhamento:** O texto transcrito é enviado para o Ramo 3 (Texto).

### **3.2. Ramo 2: Imagem (Recibos e Comprovativos Pix)**

1. **Bufferização (Code Node):** É instanciado um nó de código JavaScript (Node.js) para converter a imagem num formato seguro (Base64) usando a função getBinaryDataBuffer(). Isto evita fugas de memória no servidor e garante o transporte fiável da imagem.  
2. **Visão Computacional (GPT-4o):** A imagem em Base64 é submetida ao GPT-4o com um *prompt* estrito (System Prompt).  
3. **Restrição JSON Mode:** A API é forçada a responder *exclusivamente* no formato JSON predefinido, expurgando impostos, ruídos visuais e mensagens de marketing do recibo.

### **3.3. Ramo 3: Texto (Processamento de Linguagem Natural)**

O texto (digitado ou transcrito do áudio) passa pelo GPT-4o para extração de entidades (Entity Extraction).

**Exemplo de *System Prompt* para a IA:**

"És um assistente financeiro de extrema precisão. Analisa a mensagem do utilizador e extrai as métricas para inserção no banco de dados. Responde estritamente em JSON com as chaves: amount\_cents (inteiro), merchant\_name (string), type (EXPENSE, INCOME, TRANSFER), account\_identificator (string), date (ISO 8601)."

## **4\. O Mecanismo Anticolisão (Deduplicação)**

Antes de injetar o dado no banco, o sistema tem de impedir duplicações (ex: o utilizador enviou um áudio e, logo a seguir, a foto do mesmo recibo para "garantir").

1. **PostgreSQL Node (Query de Verificação):**  
   * O n8n faz um SELECT rápido na tabela transactions.  
   * Verifica se, nas últimas 2 horas, existe uma transação com o mesmo amount\_cents e um merchant\_name semelhante para aquele family\_group\_id.  
2. **Decisão Lógica (If Node):**  
   * Se existir correspondência: O sistema não insere a transação e avisa o utilizador: *"Parece que já registei esta despesa de \[Valor\] no \[Estabelecimento\] hoje. Deseja duplicar?"*  
   * Se não existir correspondência: Prossegue para a inserção.

## **5\. Injeção de Dados e Motor Transacional**

1. **PostgreSQL Node (Insert):** O JSON perfeito gerado pela IA é mapeado para as colunas exatas da tabela transactions que desenhámos na arquitetura de banco de dados.  
2. **Tratamento de Contas e Categorias:** O sistema da IA fará a correspondência do texto (ex: "cartão Nubank") com o account\_id existente no banco de dados através de uma busca prévia armazenada na cache do n8n.

## **6\. Fluxo de Resposta (Engenharia Comportamental)**

Após o registo bem-sucedido no PostgreSQL, o n8n responde ao utilizador pelo WhatsApp. Aqui aplicamos a regra do reforço positivo (Dopamina).

1. **Cálculo Rápido:** O n8n faz um pequeno SELECT SUM no orçamento daquela categoria.  
2. **Geração de Mensagem (GPT-4o-mini):** O n8n pede à IA para criar uma mensagem curta, amigável e motivacional.  
3. **Atraso Lógico (Delay Node \- Anti-ban):** O n8n aguarda entre 2 a 5 segundos (simulando digitação humana) antes de enviar a resposta. Isto disfarça o padrão robótico da Evolution API, protegendo o número contra banimentos do WhatsApp.  
4. **Envio da Resposta:** *"Registo feito\! 🍔 Gastou 25€ no Pingo Doce. Ainda tem 150€ no seu orçamento de Alimentação para este mês. Está num ótimo caminho\!"*
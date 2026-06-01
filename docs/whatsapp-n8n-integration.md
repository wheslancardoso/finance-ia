# Manual de Integração: Jarvis no WhatsApp via n8n & Vesper Finance

Este manual detalha a arquitetura de atrito zero desenvolvida para o **Jarvis (Vesper AI) no WhatsApp**. Ele permite que você cadastre transações, faça simulações preditivas e consulte sua saúde financeira em tempo real diretamente de uma conversa do WhatsApp usando linguagem natural.

---

## 🏗️ Arquitetura do Fluxo de Dados

O fluxo funciona de forma integrada, segura e com custo zero de infraestrutura:

```
┌──────────────┐         ┌───────────┐         ┌────────────┐         ┌────────────┐
│   WhatsApp   │ ──────> │    n8n    │ ──────> │ Vesper BFF │ ──────> │  Supabase  │
│  (Seu Cel)   │ <────── │  Gateway  │ <────── │ Route API  │ <────── │ (Database) │
└──────────────┘         └───────────┘         └────────────┘         └────────────┘
```

1. **Mensagem enviada**: Você envia uma mensagem de texto simples no WhatsApp (ex: *"Salgado 8,50 nubank"*).
2. **Gateway/Webhook**: O gateway de WhatsApp conectado ao n8n (ex: Evolution API, Z-API, Baileys, etc.) dispara um gatilho Webhook enviando a mensagem e o seu telefone.
3. **Orquestração n8n**: O n8n higieniza o payload e faz uma requisição HTTP POST autenticada para o endpoint seguro `/api/whatsapp` do Vesper.
4. **Cognição Vesper (Next.js & Gemini)**:
   - Valida o segredo de segurança.
   - Saneia o telefone e busca o seu perfil no Supabase para autenticação.
   - Dispara a chamada cognitiva à IA, injetando todo o seu histórico financeiro real recente (contas, categorias, transações, orçamentos e memórias).
   - Se for um **Gasto Direto** (*"persist: true"*), o backend insere fisicamente a transação no PostgreSQL do Supabase na hora (com suporte a lançamentos à vista e parcelados com datas calculadas!).
   - Se for uma **Simulação Preditiva** (*"persist: false"*), apenas simula o gap financeiro e as projeções.
   - Salva a conversa na memória de longo prazo (`chat_memory`) compartilhada com o Dashboard do app.
5. **Retorno**: O Jarvis devolve a resposta didática (plain text, limpa de markdown) para o n8n, que a despacha de volta para o seu WhatsApp!

---

## ⚙️ Configuração do Workflow no n8n

O workflow no seu n8n é super simples e composto por apenas 3 nós:

```
[Webhook Node (Gatilho)] ───> [HTTP Request (Vesper BFF)] ───> [HTTP Request (WhatsApp Gateway)]
```

### 1. Nó Webhook (Gatilho de Entrada)
- **Método**: `POST`
- **Path**: `vesper-whatsapp-webhook`
- **Função**: Recebe o payload do seu gateway do WhatsApp.
- **Mapeamento de Expressões no n8n**:
  - **Telefone (Remetente)**: `{{ $json.body.sender.replace('@s.whatsapp.net', '') }}` (saneamento para manter apenas dígitos com DDD, ex: `5511999999999`).
  - **Texto da Mensagem**: `{{ $json.body.message.conversation || $json.body.message.extendedTextMessage.text }}`

### 2. Nó HTTP Request (Comunicação com o Vesper)
Este nó faz a ponte cognitiva com o Vesper Finance BFF.
- **Método**: `POST`
- **URL**: `https://sua-plataforma-vesper.vercel.app/api/whatsapp?secret=vesper_jarvis_whatsapp_secret_key_123`
- **Headers**:
  - `Content-Type`: `application/json`
  - `x-whatsapp-secret`: `vesper_jarvis_whatsapp_secret_key_123`
- **Body Parameters (JSON)**:
  ```json
  {
    "phone": "{{ $node.Webhook.json.phone }}",
    "text": "{{ $node.Webhook.json.text }}"
  }
  ```

### 3. Nó HTTP Request (WhatsApp Gateway - Envio da Confirmação)
Este nó devolve a resposta didática do Jarvis para o seu celular.
- **Método**: `POST`
- **URL**: Endereço do endpoint de envio de mensagem do seu gateway (ex: `/message/sendText` da Evolution API ou similar).
- **Headers**: Conforme exigido pelo token/API do seu gateway de WhatsApp.
- **Body Parameters (JSON)**:
  - **Destinatário**: `{{ $node.Webhook.json.phone }}`
  - **Texto**: `{{ $node["HTTP Request (Vesper BFF)"].json.responseText }}` (a resposta de mentoria e confirmação limpa de markdown enviada pelo Jarvis!).

---

## 🔒 Camada de Segurança e Vínculo de Telefone

Para garantir que ninguém envie mensagens ou manipule seus dados financeiros sem permissão, implementamos duas barreiras rígidas de proteção:

1. **Segredo Compartilhado (Webhook Secret)**:
   - A rota `/api/whatsapp` exige obrigatoriamente que a chave secreta de segurança (configurada na variável `WHATSAPP_WEBHOOK_SECRET` no seu `.env.local`) seja enviada na URL (`?secret=...`) ou no cabeçalho `x-whatsapp-secret`.
   - Se o segredo for inválido, o sistema bloqueia o acesso instantaneamente retornando **401 Unauthorized**.

2. **Correspondência Rígida de Perfil (Vínculo de Telefone)**:
   - O backend higieniza o telefone recebido e faz uma busca na tabela `profiles` coluna `whatsapp_number`.
   - Se o número não estiver devidamente cadastrado nas configurações da sua conta, o Jarvis responde de forma amigável instruindo o usuário sobre como se conectar:
     > OLÁ! NÃO ENCONTREI NENHUMA CONTA VINCULADA A ESTE WHATSAPP.
     > PARA CONECTAR, ACESSE O APP VESPER, VÁ EM CONFIGURAÇÕES E VINCULE SEU NÚMERO DE TELEFONE COM DDD.

---

## 💬 Exemplos Práticos de Interação

O Jarvis interpreta linguagem natural de forma flexível e inteligente:

### 💸 Cadastro de Gastos Físicos (Persistidos no Banco na hora!)
- **Comando**: *"Salgado 8,50 nubank"*
  - *Jarvis:* Identifica uma despesa (`EXPENSE`), busca o ID da conta do Nubank, associa à categoria "Alimentação", converte para `850` centavos, seta `is_paid: false` (pois é cartão de crédito), cria e persiste a transação física no Supabase remotamente e responde confirmando o lançamento!
- **Comando**: *"Compra de 350 reais parcelado em 3x no cartão inter"*
  - *Jarvis:* Identifica despesa parcelada, cria **3 parcelas em lote** de `R$ 116,67` cada, gera o mesmo `installment_group_id`, calcula as datas de vencimento seguras das parcelas mês a mês com clamping e grava os 3 registros no Supabase na hora!
- **Comando**: *"Recebi 2500 pix Itaú"*
  - *Jarvis:* Identifica receita (`INCOME`), associa à conta Itaú, categoria "Rendimentos/Outros" como `is_paid: true` e persiste.

### 🔮 Simulações Preditivas e Perguntas didáticas (Sem gravar no banco!)
- **Comando**: *"Posso comprar um celular de R$ 3.000 parcelado em 12x?"*
  - *Jarvis:* Cria uma simulação temporária (`"persist": false`), calcula o impacto de parcelas de R$ 250 nos próximos 12 meses frente às suas receitas e orçamentos futuros, e devolve o veredito preditivo com mentoria didática no WhatsApp sem criar nenhuma transação real!
- **Comando**: *"Se eu fizer um empréstimo de R$ 2.000 em 10x com 3% de juros para cobrir o déficit de junho, compensa?"*
  - *Jarvis:* Simula a operação, faz a matemática financeira exata e diz se a parcela cabe no seu fluxo de caixa mensal sem alterar o banco de dados.

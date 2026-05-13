# 🤖 Arquitetura de Automação e IA: O Vesper Bot

O Vesper Bot não é apenas uma interface de entrada de dados; é uma extensão proativa do Motor Financeiro Vesper no WhatsApp. Ele utiliza IA multimodal para transformar mensagens informais em decisões estratégicas, mantendo a integridade matemática do sistema.

---

## 🚀 1. Visão Geral do Pipeline (Multimodal)

O fluxo no n8n atua como o tradutor entre a linguagem humana não estruturada e a rigidez do banco de dados PostgreSQL (Supabase).

**Stack Tecnológica:**
*   **Orquestrador:** n8n (Self-hosted ou Cloud).
*   **Entrada:** Evolution API (Conectividade WhatsApp).
*   **Cérebro:** OpenAI GPT-4o (Extração de entidades e Visão).
*   **Ouvido:** OpenAI Whisper (Transcrição de áudio de alta fidelidade).
*   **Persistência:** Supabase (via REST API com Service Role).

---

## 🛡️ 2. Camada de Recepção e Identificação

Ao receber um webhook da Evolution API:
1.  **Filtro fromMe**: Ignora mensagens enviadas pelo próprio robô.
2.  **Identificação de Usuário**: O n8n consulta a tabela `profiles` no Supabase usando o número de telefone (ou uma chave vinculada) para recuperar o `user_id`. **Sem `user_id`, o fluxo é interrompido por segurança.**

---

## 🧠 3. Processamento de Inteligência (Roteamento)

O fluxo divide-se por tipo de mídia:

### 🎙️ A. Ramo de Áudio (Voice-to-Insight)
1.  **Whisper AI**: Converte o áudio em texto bruto.
2.  **Contextualização**: O texto é enviado para o Ramo de Texto.

### 📸 B. Ramo de Imagem (OCR & Vision)
1.  **GPT-4o Vision**: Analisa a foto de recibos, notas fiscais ou prints de tela de bancos.
2.  **Extração**: Identifica valor, data, estabelecimento e se é débito/crédito.
3.  **Prompt de Rigor**: A IA deve retornar obrigatoriamente um JSON com valores em **centavos**.

### ✍️ C. Ramo de Texto (NLP Avançado)
O GPT-4o processa o texto (direto ou vindo do áudio) com o seguinte **System Prompt**:
> "Você é o cérebro do Vesper Finance. Extraia: `amount_cents` (inteiro), `merchant_name`, `type` (EXPENSE/INCOME), `account_name` (ex: Nubank, Itaú). Converta valores para centavos (ex: R$ 10,50 -> 1050)."

---

## ⚡ 4. O Diferencial Vesper: Impacto em Tempo Real

Diferente de outros bots, o Vesper realiza uma **pré-consulta de impacto** antes de confirmar:

1.  **Consulta de Projeção**: O n8n chama a lógica de projeção (ou lê os dados consolidados) para aquele usuário.
2.  **Cálculo de Sobra**: Verifica quanto ainda resta no "Teto de Sobrevivência Semanal" daquela categoria.
3.  **Inserção Atômica**: Insere na tabela `transactions` do Supabase.

---

## 💬 5. Feedback Estratégico (Engenharia de Dopamina)

A resposta ao usuário não é apenas um "Ok". É uma atualização de vida:

**Exemplo de Resposta do Bot:**
> "Registrado! 🍔 **R$ 45,00** no *Burger King* (Débito Itaú).
> 
> **Impacto na sua semana:** Você ainda tem **R$ 120,00** de oxigênio para gastos variáveis até domingo.
> 
> **Time Machine:** Com esse gasto, sua liquidez projetada para **Agosto** continua positiva em **R$ 4.200,00**. Ótima escolha!"

---

## 🛠️ Configuração Técnica no n8n

*   **Supabase Node (ou HTTP Request)**: Utilizar a URL da API do Supabase com o Header `apikey` (Service Role) para permitir a inserção de transações em nome do usuário identificado.
*   **Deduplicação**: Antes de inserir, o n8n verifica se existe uma transação com o mesmo valor e estabelecimento nos últimos 10 minutos (proteção contra cliques duplos ou envios repetidos).
*   **Mapeamento de Categoria**: A IA sugere a categoria, mas o n8n valida contra a lista de `categories` reais do usuário no banco de dados.

---

> [!IMPORTANT]
> **Segurança de Dados**: O n8n deve ser configurado para não armazenar logs das mensagens após o processamento, mantendo a privacidade total dos dados financeiros do usuário.
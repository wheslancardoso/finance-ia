# ADR-010: Integração de Open Finance Seguro (Estritamente Read-Only)

**Status:** Rejeitado (Inviabilidade de Custos de API)  
**Autor:** Antigravity (AI Senior Software Engineer)  
**Data:** 01 de Junho de 2026

---

## 1. Contexto & Problema

O sistema Finance-IA necessita de dados financeiros reais (saldos de contas correntes, transações de faturas de cartões de crédito e limites disponíveis) para alimentar de forma automática e em tempo real a inteligência do **Oráculo de Teto de Sobrevivência** e a **Time Machine**. 

Atualmente, o input dessas informações é manual (via modal de transações) ou por mocks. Para automatizar o processo através do **Open Finance (regulamentado pelo Banco Central)** com segurança máxima para o usuário final, é imperativo que a integração seja **estritamente apenas leitura (Read-Only)**. O sistema jamais deve possuir autorização ou capacidade técnica de efetuar transações, movimentações, PIX ou pagamentos em nome do usuário.

---

## 2. Decisão Arquitetural

**Decisão de Negócio:** Rejeitada após avaliação de custos.

Embora o plano de arquitetura técnica de integração e segurança de dados do Open Finance seja robusto e viável do ponto de vista de engenharia, os custos recorrentes de manutenção das assinaturas de agregadores profissionais (Pluggy/Belvo) são desnecessariamente altos para o escopo do projeto de controle financeiro pessoal.

Desta forma, optou-se por **rejeitar o acoplamento com o Open Finance** e focar nas seguintes alternativas de custo zero/baixo:
1.  **Entrada Manual Otimizada:** Utilizar o modal rápido atual, que já nasceu otimizado e reativo com faturamento em cartões.
2.  **Integração com WhatsApp (Opcional):** Explorar gateways acessíveis para entrada de transações via Jarvis IA em linguagem natural no WhatsApp (custo infinitamente menor e altíssima experiência de uso).

```
┌───────────────────────────┐         (1) Inicializa widget
│    Frontend (Next.js)     │ ───────────────────────────────────┐
└───────────────────────────┘                                    │
              ▲                                                  ▼
              │ (5) Dados unificados                   ┌───────────────────┐
              │                                        │  Pluggy/Belvo SDK │
┌───────────────────────────┐                          └───────────────────┘
│    Backend / BFF API      │                                    │
│   (/api/open-finance)     │                                    │ (2) Login & Consentimento
└───────────────────────────┘                                    │     Read-Only (BC)
              ▲                                                  ▼
              │ (4) Sincronização segura               ┌───────────────────┐
              │                                        │   Bancos Reais    │
┌───────────────────────────┐                          └───────────────────┘
│     Supabase Postgres     │ <───────(3) Webhook ─────── [Agregador Cloud]
│ (Tabelas RLS + Crypto)    │
└───────────────────────────┘
```

---

## 3. Especificação Técnica & Segurança por Padrão (Security by Design)

### 3.1. Escopo de Consentimento Estrito (Apenas Leitura / Read-Only)
Durante a inicialização do widget de conexão do agregador (ex: Pluggy Connect), a chamada da API configurará exclusivamente os seguintes escopos (*scopes*):
*   `accounts:read` (Saldos e metadados de contas).
*   `transactions:read` (Extrato de transações de débito/crédito).
*   `credit_cards:read` (Faturas, limites e transações de cartões).

Os escopos de movimentação financeira (ex: `payments:write`, `transfers:write`) são **explicitamente ausentes** na chave de API e na inicialização do widget. Desta forma, o token gerado pelo banco do usuário fisicamente impossibilita qualquer transação de saída de dinheiro, garantindo segurança matemática de nível bancário.

### 3.2. Arquitetura BFF (Backend-For-Frontend)
*   **Segredos Protegidos:** Todas as chaves privadas e credenciais da Pluggy/Belvo residirão de forma exclusiva em variáveis de ambiente seguras no Supabase (`secrets`) ou no Next.js Backend. Nenhuma chave transita ou é exposta no lado do cliente (Frontend).
*   **Consumo das APIs:** Toda e qualquer consulta ao agregador é efetuada no servidor, utilizando o BFF. O frontend Next.js apenas consome endpoints internos autenticados por cookies HTTP-Only seguros com JWT.

### 3.3. Criptografia de Tokens de Consentimento (Data at Rest)
Os tokens de consentimento bancários (`consent_token`) e chaves de acesso geradas pelo agregador serão persistidos na tabela `bank_connections` de forma **criptografada em repouso**.
*   Utilizaremos criptografia simétrica **AES-256-GCM** com chave derivada por variável de ambiente segura armazenada fora do banco de dados.
*   No Postgres, utilizaremos a extensão de segurança nativa do Supabase `pgcrypto` ou decifraremos os segredos em memória no runtime das APIs seguras de sincronização.

### 3.4. Políticas de Controle de Acesso Rígidas (Row Level Security - RLS)
Criaremos a tabela `bank_connections` no Supabase protegida por RLS determinístico, garantindo que um usuário autenticado só possa visualizar e gerenciar suas próprias conexões bancárias:

```sql
-- Criar tabela de Conexões de Open Finance
CREATE TABLE public.bank_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'pluggy' ou 'belvo'
    connection_id VARCHAR(255) NOT NULL, -- ID do agregador
    encrypted_consent_token TEXT NOT NULL, -- Token criptografado
    bank_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativar RLS
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

-- Política RLS: Usuários só gerenciam suas próprias conexões
CREATE POLICY "Users can manage their own bank connections"
ON public.bank_connections
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## 4. Modelagem de Sincronização Automatizada

### 4.1. Mapeamento de Entidades
Quando o agregador reportar dados atualizados via Webhook, mapearemos as entidades externas para o nosso modelo de dados existente para reuso total de componentes e lógica financeira:

| Agregador (Pluggy/Belvo) | Model Vesper | Tabela Supabase |
|---|---|---|
| Account (Checking/Savings) | Account | `accounts` (type: 'CHECKING') |
| Credit Card Account | Account | `accounts` (type: 'CREDIT_CARD') |
| Transaction (Debit/Credit) | Transaction | `transactions` |

### 4.2. Fluxo de Sincronização Inteligente & Saneamento
Para evitar a duplicação de transações e limpar dados incompreensíveis das faturas de cartões:
1.  **Deduplicação de Id Único:** Cada transação bancária possui um ID único persistente no agregador (`provider_transaction_id`). Adicionaremos esse campo como índice único na tabela `transactions` para garantir que o processo de ingestão seja 100% idempotente (se rodar 2 vezes, a transação não se duplica).
2.  **Saneamento Cognitivo com IA:** Extratos bancários costumam trazer descrições poluidas (ex: `PG *MERCPAGO ALMOCO`). Criaremos um pipeline de processamento que lê a descrição bruta e usa regras rápidas ou o Copiloto (Gemini) para higienizar o nome (ex: `Almoço`) e categorizar de forma correta (ex: `Alimentação`).
3.  **Provisões de Cartão:** Transações em cartões de crédito serão adicionadas como `is_paid = false` vinculadas à fatura correta do mês de fechamento, preservando as melhorias do motor financeiro.

---

## 5. Plano de Implementação Técnica

### Passo 1: Infraestrutura e Chaves do Agregador
*   Cadastrar na Pluggy.co ou Belvo.co para obter as credenciais de teste (Sandbox) e Produção.
*   Adicionar `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` nos segredos do Supabase e no arquivo `.env` do backend.

### Passo 2: Extensão de Banco de Dados e RLS
*   Aplicar as migrações SQL para criar a tabela `bank_connections` com RLS ativado no Supabase.
*   Adicionar a coluna `provider_transaction_id VARCHAR(255) UNIQUE` na tabela `transactions`.

### Passo 3: Criação da API de Conexão (Next.js BFF)
*   `POST /api/open-finance/connect-token`: Endpoint que gera um token de uso único e seguro do agregador para abrir o Widget no frontend de forma isolada.
*   `POST /api/open-finance/webhook`: Endpoint de escuta pública protegida por token de assinatura (*signature token*) para receber atualizações automáticas de saldo e transações disparadas na nuvem.

### Passo 4: Interface do Usuário (Frontend Premium)
*   Criar o painel "Integrações Bancárias" brutalista na aba `/settings`.
*   Renderizar o botão interativo "Conectar Conta via Open Finance".
*   Ao clicar, inicializa o Pluggy Widget de consentimento 100% seguro (Read-Only).

---

## 6. Consequências & Trade-offs

### Benefícios
*   **Automatização Completa:** Transações e faturas sincronizadas de forma 100% autônoma, sem necessidade de entrada manual de dados pelo usuário.
*   **Segurança por Design:** Paz de espírito total para o usuário devido ao escopo estrito e inflexível de apenas leitura, validado em conformidade com as diretrizes do Banco Central do Brasil.
*   **Consistência de Inteligência:** O Oráculo de Sobrevivência recebe as atualizações instantaneamente, tornando seus conselhos e alertas no WhatsApp cirúrgicos e precisos.

### Limitações e Desafios
*   **Instabilidade de APIs Bancárias:** Bancos podem sofrer lentidão em finais de semana, de modo que o webhook do agregador pode demorar algumas horas para processar. Exibiremos um badge "Sincronizado há N minutos" para dar transparência ao usuário.
*   **Expiração de Consentimento:** Pelo regulamento do Open Finance, consentimentos duram até 180 dias. O sistema precisará notificar o usuário amigavelmente para ele reconectar sua conta de forma rápida quando o token estiver próximo de expirar.

---

## 7. Plano de Verificação de Segurança (Verification Plan)

### Testes de Invasão & Segurança de Dados
*   **Validação RLS:** Teste de integração automatizado no Supabase para validar que o Usuário A **jamais** consegue acessar ou atualizar os dados de conexão bancária ou transação do Usuário B (passando um ID de conexão forçado no endpoint).
*   **Validação de Escopo:** Teste unitário certificando que a chamada de inicialização do agregador em nenhum momento solicita permissão de movimentação de conta.
*   **Sanitização de XSS:** Validar que descrições de transações bancárias poluídas ou contendo caracteres especiais injetados sejam renderizadas com escaping nativo do React JSX no frontend, eliminando qualquer risco de XSS.

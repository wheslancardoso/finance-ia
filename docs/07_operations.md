# 🚀 Guia de Onboarding e Deployment

Este guia descreve como configurar o ambiente de desenvolvimento, rodar o projeto localmente e realizar o deploy do Vesper Finance.

---

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:
*   **Node.js** (v18 ou superior)
*   **npm** ou **pnpm** (recomendado)
*   **Git**

---

## 🛠️ Configuração do Ambiente Local

### 1. Clonar o Repositório e Instalar Dependências
```bash
git clone https://github.com/usuario/finance-ia.git
cd finance-ia
npm install
```

### 2. Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz do projeto com as seguintes chaves do seu projeto Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://sua-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima
```

### 3. Configuração do Supabase
Para que o app funcione, você precisa executar os scripts SQL (localizados em `/supabase/migrations`) no SQL Editor do Supabase para criar:
*   As tabelas (profiles, transactions, accounts, etc).
*   As políticas de **RLS (Row Level Security)**.
*   As funções e triggers de atualização de timestamps.

---

## 🏃 Comandos de Desenvolvimento

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento em `localhost:3000`. |
| `npm run build` | Gera o build de produção (otimizado). |
| `npm run start` | Inicia o servidor com o build de produção. |
| `npm run lint` | Verifica erros de estilo e padrões de código. |
| `npm run test` | Executa a suíte de testes E2E Playwright. |

---

## 🚢 Estratégia de Deployment

### Frontend (Vercel)
O Vesper é otimizado para a **Vercel**. 
1.  Conecte o repositório GitHub.
2.  Adicione as variáveis de ambiente (`NEXT_PUBLIC_...`).
3.  O deploy será automático a cada push na branch `main`.

### Backend (Supabase)
O banco de dados e a autenticação já residem no Supabase. Certifique-se de que a URL da sua aplicação Vercel esteja na lista de domínios permitidos (Whitelist) no painel de Auth do Supabase.

---

## 🔄 Manutenção e Migrações

### Atualizando o Banco Local (Dexie)
Se você adicionar uma nova coluna às entidades no Supabase, lembre-se de atualizar o schema no arquivo `src/lib/db.ts` (Dexie) para manter a sincronia offline:

```typescript
// Exemplo em src/lib/db.ts
export const db = new Dexie('VesperDB') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>;
  // Adicione novas tabelas/campos aqui
};
```

---

> [!CAUTION]
> **Segurança**: Nunca comite o arquivo `.env.local` com chaves reais. Use sempre o `.env.example` como template para o repositório.

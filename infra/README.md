# 🐳 Vesper Infra - Local Dev

Este diretório contém a infraestrutura necessária para rodar o Vesper Finance localmente via Docker.

## Componentes
- **Postgres 15**: Banco de dados relacional com o esquema completo (Fase 5).
- **PostgREST**: Camada de API que expõe o banco de dados via REST (substitui o Supabase localmente).
- **Frontend**: Aplicação Vite rodando em modo dev.
- **Nginx**: Proxy reverso para unificar o acesso (Porta 80).

## Como Rodar

1. Certifique-se de ter o Docker e Docker Compose instalados.
2. No diretório `infra/`, execute:
   ```bash
   docker-compose up --build
   ```
3. Acesse o app em: `http://localhost`

## Detalhes da API
A API está disponível em `http://localhost/rest/v1`.
As funções RPC podem ser chamadas via POST:
- `POST /rest/v1/rpc/get_financial_state_v5`
- `POST /rest/v1/rpc/create_installment_series`
- etc.

## Banco de Dados
O banco é inicializado automaticamente com o arquivo `postgres/init.sql`.
Credenciais padrão:
- Usuário: `postgres`
- Senha: `password`
- Porta: `5432`

#!/bin/bash
set -e

# Configurações
PROJECT_ROOT="/home/lan/finance-ia"
NETWORK_NAME="vesper-network"

echo "🚀 Iniciando Vesper Finance Local Stack (Manual Mode)..."

# 1. Criar rede se não existir
if ! docker network inspect $NETWORK_NAME >/dev/null 2>&1; then
    echo "🌐 Criando rede $NETWORK_NAME..."
    docker network create $NETWORK_NAME
fi

# 1.5 Limpar containers antigos (se existirem)
echo "🧹 Limpando containers antigos..."
docker rm -f vesper-db vesper-api vesper-nginx postgrest || true

# 2. Iniciar Postgres
echo "🐘 Iniciando Postgres..."
docker run -d \
  --name vesper-db \
  --network $NETWORK_NAME \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=postgres \
  -p 5432:5432 \
  -v $PROJECT_ROOT/infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql \
  postgres:15-alpine

# Esperar o banco ficar pronto
echo "⏳ Aguardando Postgres ficar pronto..."
until docker exec vesper-db pg_isready -U postgres; do
  sleep 1
done

# 3. Iniciar PostgREST
echo "📡 Iniciando PostgREST..."
docker run -d \
  --name vesper-api \
  --network $NETWORK_NAME \
  -e PGRST_DB_URI=postgres://authenticator:vesper_secret_password@vesper-db:5432/postgres \
  -e PGRST_DB_SCHEMA=public \
  -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters \
  -p 3002:3000 \
  postgrest/postgrest

echo "✅ Stack iniciada com sucesso!"
echo "📍 API / Auth Mock (via Next.js): http://localhost:3000"
echo "🐘 Banco de Dados: localhost:5432"
echo "💻 Frontend: Rode 'npm run dev' em outro terminal"

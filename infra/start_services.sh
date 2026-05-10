#!/bin/bash
set -e

# Configurações
PROJECT_ROOT="/home/lan/finance-ia"
NETWORK_NAME="vesper-network"

echo "🚀 Iniciando Vesper Finance Local Stack..."

# 1. Criar rede se não existir
docker network create $NETWORK_NAME || true

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
  --name postgrest \
  --network $NETWORK_NAME \
  -e PGRST_DB_URI=postgres://postgres:password@vesper-db:5432/postgres \
  -e PGRST_DB_SCHEMA=public \
  -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters \
  postgrest/postgrest

# 4. Iniciar Nginx (Proxy & Auth Mock)
echo "🛡️ Iniciando Nginx (Porta 3001)..."
docker run -d \
  --name vesper-nginx \
  --network $NETWORK_NAME \
  -p 3001:80 \
  -v $PROJECT_ROOT/infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  nginx:alpine

echo "✅ Stack iniciada com sucesso!"
echo "📍 API / Auth Mock: http://localhost:3001"
echo "🐘 Banco de Dados: localhost:5432"

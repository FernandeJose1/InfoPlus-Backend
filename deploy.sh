#!/bin/bash

# Script de deploy para produção
set -e

echo "🚀 Iniciando deploy do Infoplus Backend..."
echo "📍 Ambiente: ${NODE_ENV:-production}"

# Carregar variáveis de ambiente
if [ -f .env ]; then
    echo "📖 Carregando variáveis de ambiente..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Verificar variáveis necessárias
required_vars=(
  "PAYSUITE_API_KEY"
  "PAYSUITE_WEBHOOK_SECRET"
  "FIREBASE_PROJECT_ID"
  "FIREBASE_PRIVATE_KEY"
  "FIREBASE_CLIENT_EMAIL"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Variável necessária não definida: $var"
    exit 1
  fi
done

echo "✅ Variáveis de ambiente verificadas"

# Build da imagem Docker
echo "📦 Construindo imagem Docker..."
docker build -t infoplus-backend:latest .

# Parar container existente
echo "🛑 Parando container existente..."
docker stop infoplus-backend || true
docker rm infoplus-backend || true

# Executar novo container
echo "🎯 Iniciando novo container..."
docker run -d \
  --name infoplus-backend \
  --network host \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e PAYSUITE_API_KEY="$PAYSUITE_API_KEY" \
  -e PAYSUITE_WEBHOOK_SECRET="$PAYSUITE_WEBHOOK_SECRET" \
  -e PAYSUITE_BASE_URL="$PAYSUITE_BASE_URL" \
  -e FIREBASE_PROJECT_ID="$FIREBASE_PROJECT_ID" \
  -e FIREBASE_PRIVATE_KEY="$FIREBASE_PRIVATE_KEY" \
  -e FIREBASE_PRIVATE_KEY_ID="$FIREBASE_PRIVATE_KEY_ID" \
  -e FIREBASE_CLIENT_EMAIL="$FIREBASE_CLIENT_EMAIL" \
  -e FIREBASE_CLIENT_ID="$FIREBASE_CLIENT_ID" \
  -e FIREBASE_AUTH_URI="$FIREBASE_AUTH_URI" \
  -e FIREBASE_TOKEN_URI="$FIREBASE_TOKEN_URI" \
  -e FIREBASE_AUTH_PROVIDER_CERT_URL="$FIREBASE_AUTH_PROVIDER_CERT_URL" \
  -e FIREBASE_CLIENT_CERT_URL="$FIREBASE_CLIENT_CERT_URL" \
  -e FIREBASE_DATABASE_URL="$FIREBASE_DATABASE_URL" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e CORS_ORIGIN="$CORS_ORIGIN" \
  -e DEFAULT_PAYMENT_TIMEOUT="$DEFAULT_PAYMENT_TIMEOUT" \
  -e MAX_RETRY_ATTEMPTS="$MAX_RETRY_ATTEMPTS" \
  -e LOG_LEVEL="$LOG_LEVEL" \
  --restart unless-stopped \
  infoplus-backend:latest

echo "⏳ Aguardando inicialização..."
sleep 5

# Verificar se o container está rodando
if docker ps | grep -q "infoplus-backend"; then
    echo "✅ Container iniciado com sucesso"
else
    echo "❌ Falha ao iniciar container"
    docker logs infoplus-backend
    exit 1
fi

# Verificar health check
echo "🏥 Verificando health check..."
health_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || true)

if [ "$health_response" = "200" ]; then
    echo "✅ Health check passou"
else
    echo "❌ Health check falhou: HTTP $health_response"
    docker logs infoplus-backend
    exit 1
fi

echo "🎉 Deploy concluído com sucesso!"
echo "📊 Verifique os logs: docker logs -f infoplus-backend"
echo "🌐 Health check: http://localhost:3000/health"
echo "🔗 API: http://localhost:3000/"
#!/bin/bash

# Script de deploy sem Docker
set -e

echo "🚀 Iniciando deploy do Infoplus Backend..."
echo "📍 Ambiente: ${NODE_ENV:-production}"

# Carregar variáveis de ambiente de forma segura
if [ -f .env ]; then
    echo "📖 Carregando variáveis de ambiente..."
    while IFS= read -r line || [ -n "$line" ]; do
        if [ -n "$line" ] && [[ ! "$line" =~ ^[[:space:]]*# ]]; then
            var_name=$(echo "$line" | cut -d '=' -f 1)
            var_value=$(echo "$line" | cut -d '=' -f 2-)
            var_value=$(echo "$var_value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
            export "$var_name"="$var_value"
        fi
    done < .env
fi

# Verificar variáveis necessárias
required_vars=(
  "PAYSUITE_API_KEY"
  "PAYSUITE_WEBHOOK_SECRET"
  "FIREBASE_PROJECT_ID"
  "FIREBASE_CLIENT_EMAIL"
  "PARSE_APP_ID"
  "PARSE_JS_KEY"
  "PARSE_SERVER_URL"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Variável necessária não definida: $var"
    exit 1
  fi
done

echo "✅ Variáveis de ambiente verificadas"

# Parar instância antiga (se houver)
if pgrep -f "node src/server.js" > /dev/null; then
    echo "🛑 Parando instância antiga..."
    pkill -f "node src/server.js" || true
fi

# Iniciar nova instância em background
echo "🎯 Iniciando servidor..."
nohup node src/server.js > backend.log 2>&1 &

sleep 5

# Verificar health check
echo "🏥 Verificando health check..."
max_attempts=5
attempt=1

while [ $attempt -le $max_attempts ]; do
    health_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || true)
    if [ "$health_response" = "200" ]; then
        echo "✅ Health check passou"
        break
    fi
    echo "⏳ Tentativa $attempt de $max_attempts - Health check: HTTP $health_response"
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ Health check falhou"
        tail -n 50 backend.log
        exit 1
    fi
    sleep 2
    attempt=$((attempt + 1))
done

echo "🎉 Deploy concluído com sucesso!"
echo "📊 Logs: tail -f backend.log"
echo "🌐 API: http://localhost:3000/"
#!/bin/bash

# Script para monitorar logs em tempo real
# Uso: ./monitor-logs.sh [filtro]

echo "🔍 Monitorando logs do WhatsApp API em tempo real..."
echo "📝 Filtro aplicado: ${1:-'todos os logs'}"
echo "⏹️  Pressione Ctrl+C para parar"
echo "----------------------------------------"

if [ -z "$1" ]; then
    # Monitorar todos os logs
    docker logs whatsapp_web_api --follow --timestamps
else
    # Monitorar logs com filtro
    docker logs whatsapp_web_api --follow --timestamps | grep -i "$1"
fi 
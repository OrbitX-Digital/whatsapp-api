#!/bin/bash

# Script específico para monitorar logs da rota activeGroups
# Uso: ./monitor-active-groups.sh

echo "🔍 Monitorando logs da rota /contact/activeGroups em tempo real..."
echo "📊 Incluindo logs de debug e validação de sessão"
echo "⏹️  Pressione Ctrl+C para parar"
echo "----------------------------------------"

docker logs whatsapp_web_api --follow --timestamps | grep -E "(activeGroups|getActiveGroups|session|DEBUG|error)" --color=always 
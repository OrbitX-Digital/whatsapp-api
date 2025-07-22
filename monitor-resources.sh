#!/bin/bash
# monitor-resources.sh
# Script para monitorar recursos do WhatsApp API

echo "=== WhatsApp API Resource Monitor ==="
echo "Data: $(date)"
echo ""

echo "=== Docker Container Stats ==="
docker stats whatsapp_web_api --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" 2>/dev/null || echo "Container não encontrado ou não está rodando"

echo ""
echo "=== System Memory ==="
free -h

echo ""
echo "=== System CPU ==="
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print "CPU Usage: " $1 "%"}'

echo ""
echo "=== Active Sessions ==="
curl -s "http://localhost:3000/session/list" 2>/dev/null | jq '.result | length' 2>/dev/null || echo "Error getting sessions or jq not installed"

echo ""
echo "=== Chromium Processes ==="
CHROMIUM_COUNT=$(ps aux | grep -i chromium | grep -v grep | wc -l)
echo "Chromium processes: $CHROMIUM_COUNT"

echo ""
echo "=== Node.js Processes ==="
NODE_COUNT=$(ps aux | grep -i node | grep -v grep | wc -l)
echo "Node.js processes: $NODE_COUNT"

echo ""
echo "=== Docker Container Details ==="
docker inspect whatsapp_web_api --format='{{.State.Status}}' 2>/dev/null || echo "Container não encontrado"

echo ""
echo "=== Memory Usage by Process ==="
ps aux --sort=-%mem | head -10 | awk '{print $2, $3, $4, $11}' | column -t

echo ""
echo "=== CPU Usage by Process ==="
ps aux --sort=-%cpu | head -10 | awk '{print $2, $3, $11}' | column -t

echo ""
echo "=== Disk Usage ==="
df -h | grep -E "(Filesystem|/dev)"

echo ""
echo "=== Container Logs (Last 5 lines) ==="
docker logs whatsapp_web_api --tail 5 2>/dev/null || echo "Não foi possível acessar logs do container"

echo ""
echo "=== Network Connections ==="
netstat -tuln | grep :3000 || echo "Porta 3000 não está em uso"

echo ""
echo "=== End of Report ==="
echo "Monitoramento concluído em: $(date)" 
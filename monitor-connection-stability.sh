#!/bin/bash

# Monitor de Estabilidade de Conexão WhatsApp API
# Monitora a saúde das sessões e dispara alertas quando necessário

API_BASE_URL="http://localhost:3000"
API_KEY="kjasgduIAGSOudylgasIDBHUDOA"
ALERT_THRESHOLD_RECONNECTS=5
ALERT_THRESHOLD_MEMORY=80
LOG_FILE="/var/log/whatsapp-connection-monitor.log"
REPORT_INTERVAL=60 # segundos
MAX_FAILED_SESSIONS_PERCENT=50

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função de logging
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Função para fazer requisições à API
api_request() {
    local endpoint=$1
    local method=${2:-GET}
    
    curl -s -X "$method" \
         -H "Content-Type: application/json" \
         -H "x-api-key: $API_KEY" \
         "$API_BASE_URL$endpoint"
}

# Verificar saúde do sistema
check_system_health() {
    echo -e "${BLUE}=== VERIFICAÇÃO DE SAÚDE DO SISTEMA ===${NC}"
    
    local health_response=$(api_request "/monitoring/health")
    local status=$(echo "$health_response" | jq -r '.result.status // "unknown"')
    local total_sessions=$(echo "$health_response" | jq -r '.result.sessionMonitor.totalSessions // 0')
    local active_sessions=$(echo "$health_response" | jq -r '.result.sessionMonitor.activeSessions // 0')
    local failed_sessions=$(echo "$health_response" | jq -r '.result.sessionMonitor.failedSessions // 0')
    local memory_percentage=$(echo "$health_response" | jq -r '.result.systemInfo.memoryUsage.heapUsed / .result.systemInfo.memoryUsage.heapTotal * 100 // 0')
    
    echo "Status Geral: $status"
    echo "Sessões Totais: $total_sessions"
    echo "Sessões Ativas: $active_sessions"
    echo "Sessões Falhadas: $failed_sessions"
    echo "Uso de Memória: $(printf "%.1f" "$memory_percentage")%"
    
    # Alertas baseados em métricas
    case $status in
        "healthy")
            echo -e "${GREEN}✅ Sistema funcionando normalmente${NC}"
            log_message "INFO" "System health check: HEALTHY - $active_sessions/$total_sessions sessions active"
            ;;
        "degraded")
            echo -e "${YELLOW}⚠️  Sistema com performance degradada${NC}"
            log_message "WARN" "System health check: DEGRADED - $failed_sessions failed sessions detected"
            send_alert "DEGRADED" "Sistema com performance degradada: $failed_sessions sessões falharam"
            ;;
        "critical")
            echo -e "${RED}🚨 Sistema em estado crítico${NC}"
            log_message "ERROR" "System health check: CRITICAL - System requires immediate attention"
            send_alert "CRITICAL" "Sistema em estado crítico: $failed_sessions/$total_sessions sessões falharam"
            ;;
        *)
            echo -e "${RED}❌ Status desconhecido ou falha na API${NC}"
            log_message "ERROR" "System health check: UNKNOWN - API may be down"
            ;;
    esac
    
    # Verificar uso de memória
    if (( $(echo "$memory_percentage > $ALERT_THRESHOLD_MEMORY" | bc -l) )); then
        echo -e "${YELLOW}⚠️  Alto uso de memória: $(printf "%.1f" "$memory_percentage")%${NC}"
        log_message "WARN" "High memory usage detected: $(printf "%.1f" "$memory_percentage")%"
        send_alert "MEMORY" "Alto uso de memória: $(printf "%.1f" "$memory_percentage")%"
    fi
    
    echo ""
}

# Verificar métricas de conexão
check_connection_metrics() {
    echo -e "${BLUE}=== MÉTRICAS DE CONEXÃO ===${NC}"
    
    local metrics_response=$(api_request "/monitoring/metrics")
    local avg_reconnects=$(echo "$metrics_response" | jq -r '.result.stability.averageReconnectsPerSession // 0')
    local high_reconnect_sessions=$(echo "$metrics_response" | jq -r '.result.stability.sessionsWithHighReconnects // 0')
    local total_reconnections=$(echo "$metrics_response" | jq -r '.result.overall.totalReconnections // 0')
    local average_uptime=$(echo "$metrics_response" | jq -r '.result.overall.averageUptime // 0')
    
    echo "Reconexões médias por sessão: $(printf "%.2f" "$avg_reconnects")"
    echo "Sessões com muitas reconexões: $high_reconnect_sessions"
    echo "Total de reconexões: $total_reconnections"
    echo "Uptime médio: $(printf "%.0f" "$average_uptime") segundos"
    
    # Alertas de estabilidade
    if (( $(echo "$avg_reconnects > $ALERT_THRESHOLD_RECONNECTS" | bc -l) )); then
        echo -e "${YELLOW}⚠️  Muitas reconexões detectadas (média: $(printf "%.2f" "$avg_reconnects"))${NC}"
        log_message "WARN" "High reconnection rate detected: average $(printf "%.2f" "$avg_reconnects") per session"
        send_alert "RECONNECTIONS" "Taxa alta de reconexões: média de $(printf "%.2f" "$avg_reconnects") por sessão"
    fi
    
    if [ "$high_reconnect_sessions" -gt 0 ]; then
        echo -e "${RED}🚨 $high_reconnect_sessions sessões com reconexões excessivas${NC}"
        log_message "ERROR" "$high_reconnect_sessions sessions with excessive reconnections"
    fi
    
    echo ""
}

# Verificar alertas do sistema
check_system_alerts() {
    echo -e "${BLUE}=== ALERTAS DO SISTEMA ===${NC}"
    
    local alerts_response=$(api_request "/monitoring/alerts")
    local total_alerts=$(echo "$alerts_response" | jq -r '.result.summary.total // 0')
    local high_alerts=$(echo "$alerts_response" | jq -r '.result.summary.high // 0')
    local medium_alerts=$(echo "$alerts_response" | jq -r '.result.summary.medium // 0')
    
    if [ "$total_alerts" -eq 0 ]; then
        echo -e "${GREEN}✅ Nenhum alerta ativo${NC}"
        return
    fi
    
    echo "Total de alertas: $total_alerts"
    echo "Alertas críticos: $high_alerts"
    echo "Alertas médios: $medium_alerts"
    
    # Mostrar alertas críticos
    if [ "$high_alerts" -gt 0 ]; then
        echo -e "${RED}🚨 ALERTAS CRÍTICOS:${NC}"
        echo "$alerts_response" | jq -r '.result.alerts[] | select(.severity == "high") | "- [\(.type)] \(.message)"'
        log_message "ERROR" "$high_alerts critical alerts detected"
    fi
    
    # Mostrar alertas médios
    if [ "$medium_alerts" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  ALERTAS MÉDIOS:${NC}"
        echo "$alerts_response" | jq -r '.result.alerts[] | select(.severity == "medium") | "- [\(.type)] \(.message)"'
    fi
    
    echo ""
}

# Listar sessões problemáticas
check_problematic_sessions() {
    echo -e "${BLUE}=== SESSÕES PROBLEMÁTICAS ===${NC}"
    
    local sessions_response=$(api_request "/monitoring/sessions")
    local problematic_sessions=$(echo "$sessions_response" | jq -r '.result[] | select(.reconnectCount > 3 or .status == "failed" or .status == "disconnected")')
    
    if [ -z "$problematic_sessions" ]; then
        echo -e "${GREEN}✅ Nenhuma sessão problemática detectada${NC}"
        return
    fi
    
    echo "$sessions_response" | jq -r '.result[] | select(.reconnectCount > 3 or .status == "failed" or .status == "disconnected") | "🔴 \(.sessionId) - Status: \(.status), Reconexões: \(.reconnectCount)"'
    
    local problem_count=$(echo "$sessions_response" | jq '[.result[] | select(.reconnectCount > 3 or .status == "failed" or .status == "disconnected")] | length')
    log_message "WARN" "$problem_count problematic sessions detected"
    
    echo ""
}

# Função para enviar alertas (pode ser integrada com Slack, email, etc.)
send_alert() {
    local severity=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Log do alerta
    log_message "ALERT" "[$severity] $message"
    
    # Aqui você pode integrar com sistemas de alerta
    # Exemplos:
    # - Enviar para Slack
    # - Enviar email
    # - Enviar para Discord
    # - Integrar com Prometheus/Grafana
    
    echo -e "${RED}📢 ALERTA [$severity]: $message${NC}"
}

# Função para tentar reconectar sessões problemáticas
attempt_reconnect_problematic_sessions() {
    echo -e "${BLUE}=== TENTATIVA DE RECONEXÃO AUTOMÁTICA ===${NC}"
    
    local sessions_response=$(api_request "/monitoring/sessions")
    local failed_sessions=$(echo "$sessions_response" | jq -r '.result[] | select(.status == "failed" or .status == "disconnected") | .sessionId')
    
    if [ -z "$failed_sessions" ]; then
        echo -e "${GREEN}✅ Nenhuma sessão necessita reconexão${NC}"
        return
    fi
    
    echo "Tentando reconectar sessões falhadas..."
    while IFS= read -r session_id; do
        echo "Reconectando sessão: $session_id"
        local reconnect_response=$(api_request "/monitoring/sessions/$session_id/reconnect" "POST")
        local success=$(echo "$reconnect_response" | jq -r '.success // false')
        
        if [ "$success" = "true" ]; then
            echo -e "${GREEN}✅ Reconexão iniciada para $session_id${NC}"
            log_message "INFO" "Reconnection initiated for session $session_id"
        else
            echo -e "${RED}❌ Falha ao reconectar $session_id${NC}"
            log_message "ERROR" "Failed to reconnect session $session_id"
        fi
    done <<< "$failed_sessions"
    
    echo ""
}

# Executar limpeza se necessário
perform_cleanup_if_needed() {
    local health_response=$(api_request "/monitoring/health")
    local memory_percentage=$(echo "$health_response" | jq -r '.result.systemInfo.memoryUsage.heapUsed / .result.systemInfo.memoryUsage.heapTotal * 100 // 0')
    
    # Executar limpeza se uso de memória for alto
    if (( $(echo "$memory_percentage > 85" | bc -l) )); then
        echo -e "${YELLOW}🧹 Executando limpeza devido ao alto uso de memória...${NC}"
        local cleanup_response=$(api_request "/monitoring/cleanup" "POST")
        local success=$(echo "$cleanup_response" | jq -r '.success // false')
        
        if [ "$success" = "true" ]; then
            echo -e "${GREEN}✅ Limpeza executada com sucesso${NC}"
            log_message "INFO" "Cleanup performed successfully due to high memory usage"
        else
            echo -e "${RED}❌ Falha na limpeza${NC}"
            log_message "ERROR" "Cleanup failed"
        fi
    fi
}

# Função principal de monitoramento
run_monitoring_cycle() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "======================================================"
    echo "WhatsApp API Connection Stability Monitor"
    echo "Timestamp: $timestamp"
    echo "======================================================"
    
    check_system_health
    check_connection_metrics
    check_system_alerts
    check_problematic_sessions
    
    # Ações automáticas
    attempt_reconnect_problematic_sessions
    perform_cleanup_if_needed
    
    echo "======================================================"
    echo "Monitoramento concluído"
    echo "======================================================"
    echo ""
}

# Modo de execução
case "${1:-monitor}" in
    "monitor")
        echo "Iniciando monitoramento contínuo..."
        echo "Intervalo: $REPORT_INTERVAL segundos"
        echo "Log: $LOG_FILE"
        echo "Pressione Ctrl+C para parar"
        echo ""
        
        while true; do
            run_monitoring_cycle
            sleep "$REPORT_INTERVAL"
        done
        ;;
    "once")
        run_monitoring_cycle
        ;;
    "health")
        check_system_health
        ;;
    "metrics")
        check_connection_metrics
        ;;
    "alerts")
        check_system_alerts
        ;;
    "cleanup")
        echo "Executando limpeza manual..."
        cleanup_response=$(api_request "/monitoring/cleanup" "POST")
        echo "$cleanup_response" | jq .
        ;;
    *)
        echo "Uso: $0 [monitor|once|health|metrics|alerts|cleanup]"
        echo ""
        echo "Opções:"
        echo "  monitor  - Monitoramento contínuo (padrão)"
        echo "  once     - Execução única"
        echo "  health   - Verificar apenas saúde do sistema"
        echo "  metrics  - Verificar apenas métricas"
        echo "  alerts   - Verificar apenas alertas"
        echo "  cleanup  - Executar limpeza manual"
        exit 1
        ;;
esac 
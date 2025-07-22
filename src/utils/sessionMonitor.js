const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class SessionMonitor extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.monitoringInterval = 15000; // 15 segundos
    this.monitorTimer = null;
    this.isRunning = false;
    this.stats = {
      totalSessions: 0,
      activeSessions: 0,
      failedSessions: 0,
      reconnections: 0,
      lastUpdate: null
    };
  }

  start() {
    if (this.isRunning) {
      console.log('[SessionMonitor] Already running');
      return;
    }

    console.log('[SessionMonitor] Starting session monitoring...');
    this.isRunning = true;
    this.scheduleNextMonitoring();
  }

  stop() {
    if (!this.isRunning) {
      console.log('[SessionMonitor] Not running');
      return;
    }

    console.log('[SessionMonitor] Stopping session monitoring...');
    this.isRunning = false;
    
    if (this.monitorTimer) {
      clearTimeout(this.monitorTimer);
      this.monitorTimer = null;
    }
  }

  registerSession(sessionId, client, connectionManager) {
    console.log(`[SessionMonitor] Registering session: ${sessionId}`);
    
    const sessionInfo = {
      sessionId,
      client,
      connectionManager,
      registeredAt: new Date(),
      lastSeen: new Date(),
      status: 'initializing',
      reconnectCount: 0,
      errors: [],
      metrics: {
        messagesReceived: 0,
        messagesSent: 0,
        lastActivity: new Date()
      }
    };

    this.sessions.set(sessionId, sessionInfo);
    this.updateStats();

    // Configurar listeners para métricas
    this.setupSessionListeners(sessionInfo);
  }

  unregisterSession(sessionId) {
    console.log(`[SessionMonitor] Unregistering session: ${sessionId}`);
    
    const sessionInfo = this.sessions.get(sessionId);
    if (sessionInfo) {
      this.removeSessionListeners(sessionInfo);
      this.sessions.delete(sessionId);
      this.updateStats();
    }
  }

  setupSessionListeners(sessionInfo) {
    const { client, connectionManager } = sessionInfo;

    // Eventos do cliente
    client.on('ready', () => {
      sessionInfo.status = 'ready';
      sessionInfo.lastSeen = new Date();
      this.emit('session:ready', sessionInfo.sessionId);
    });

    client.on('disconnected', (reason) => {
      sessionInfo.status = 'disconnected';
      sessionInfo.errors.push({
        type: 'disconnected',
        reason,
        timestamp: new Date()
      });
      this.emit('session:disconnected', sessionInfo.sessionId, reason);
    });

    client.on('message', () => {
      sessionInfo.metrics.messagesReceived++;
      sessionInfo.metrics.lastActivity = new Date();
      sessionInfo.lastSeen = new Date();
    });

    // Eventos do ConnectionManager
    if (connectionManager) {
      connectionManager.on('connection:restored', () => {
        sessionInfo.reconnectCount++;
        sessionInfo.status = 'connected';
        sessionInfo.lastSeen = new Date();
        this.stats.reconnections++;
        this.emit('session:reconnected', sessionInfo.sessionId);
      });

      connectionManager.on('connection:failed', (error) => {
        sessionInfo.status = 'failed';
        sessionInfo.errors.push({
          type: 'connection_failed',
          error: error.message,
          timestamp: new Date()
        });
        this.emit('session:failed', sessionInfo.sessionId, error);
      });
    }
  }

  removeSessionListeners(sessionInfo) {
    const { client, connectionManager } = sessionInfo;
    
    if (client) {
      client.removeAllListeners('ready');
      client.removeAllListeners('disconnected');
      client.removeAllListeners('message');
    }
    
    if (connectionManager) {
      connectionManager.removeAllListeners('connection:restored');
      connectionManager.removeAllListeners('connection:failed');
    }
  }

  scheduleNextMonitoring() {
    if (!this.isRunning) return;

    this.monitorTimer = setTimeout(() => {
      this.performMonitoring();
      this.scheduleNextMonitoring();
    }, this.monitoringInterval);
  }

  async performMonitoring() {
    console.log('[SessionMonitor] Performing session health check...');
    
    const now = new Date();
    const healthReport = {
      timestamp: now,
      sessions: [],
      summary: {
        total: this.sessions.size,
        healthy: 0,
        unhealthy: 0,
        stale: 0
      }
    };

    for (const [sessionId, sessionInfo] of this.sessions) {
      const sessionHealth = await this.checkSessionHealth(sessionInfo);
      healthReport.sessions.push(sessionHealth);

      switch (sessionHealth.status) {
        case 'healthy':
          healthReport.summary.healthy++;
          break;
        case 'unhealthy':
          healthReport.summary.unhealthy++;
          break;
        case 'stale':
          healthReport.summary.stale++;
          break;
      }
    }

    this.updateStats();
    this.emit('monitoring:report', healthReport);

    // Salvar relatório
    await this.saveHealthReport(healthReport);

    // Ações corretivas
    await this.performCorrectiveActions(healthReport);
  }

  async checkSessionHealth(sessionInfo) {
    const now = new Date();
    const timeSinceLastSeen = now - sessionInfo.lastSeen;
    const staleThreshold = 5 * 60 * 1000; // 5 minutos
    const unhealthyThreshold = 2 * 60 * 1000; // 2 minutos

    let status = 'healthy';
    let issues = [];

    // Verificar se está obsoleto
    if (timeSinceLastSeen > staleThreshold) {
      status = 'stale';
      issues.push('Session has been inactive for too long');
    } else if (timeSinceLastSeen > unhealthyThreshold) {
      status = 'unhealthy';
      issues.push('Session appears to be inactive');
    }

    // Verificar estado do cliente
    try {
      if (sessionInfo.client && sessionInfo.client.pupPage) {
        if (sessionInfo.client.pupPage.isClosed()) {
          status = 'unhealthy';
          issues.push('Browser page is closed');
        }
      }

      // Verificar estado da conexão
      if (sessionInfo.client && typeof sessionInfo.client.getState === 'function') {
        const clientState = await sessionInfo.client.getState();
        if (clientState !== 'CONNECTED') {
          status = 'unhealthy';
          issues.push(`Client state is ${clientState}`);
        }
      }
    } catch (error) {
      status = 'unhealthy';
      issues.push(`Health check failed: ${error.message}`);
    }

    return {
      sessionId: sessionInfo.sessionId,
      status,
      issues,
      timeSinceLastSeen,
      reconnectCount: sessionInfo.reconnectCount,
      metrics: { ...sessionInfo.metrics },
      lastError: sessionInfo.errors.length > 0 ? sessionInfo.errors[sessionInfo.errors.length - 1] : null
    };
  }

  async performCorrectiveActions(healthReport) {
    for (const sessionHealth of healthReport.sessions) {
      const sessionInfo = this.sessions.get(sessionHealth.sessionId);
      if (!sessionInfo) continue;

      // Tentar reconectar sessões obsoletas
      if (sessionHealth.status === 'stale' && sessionInfo.connectionManager) {
        console.log(`[SessionMonitor] Attempting to reconnect stale session: ${sessionHealth.sessionId}`);
        try {
          await sessionInfo.connectionManager.forceReconnect();
        } catch (error) {
          console.error(`[SessionMonitor] Failed to reconnect session ${sessionHealth.sessionId}:`, error.message);
        }
      }

      // Limpar sessões falhadas permanentemente
      if (sessionHealth.status === 'unhealthy' && sessionHealth.reconnectCount > 10) {
        console.log(`[SessionMonitor] Removing permanently failed session: ${sessionHealth.sessionId}`);
        this.emit('session:cleanup', sessionHealth.sessionId);
      }
    }
  }

  async saveHealthReport(report) {
    try {
      const reportsDir = path.join(process.cwd(), 'reports');
      await fs.mkdir(reportsDir, { recursive: true });

      const filename = `health-report-${new Date().toISOString().slice(0, 10)}.json`;
      const filepath = path.join(reportsDir, filename);

      // Carregar relatórios existentes do dia
      let existingReports = [];
      try {
        const existingData = await fs.readFile(filepath, 'utf8');
        existingReports = JSON.parse(existingData);
      } catch (error) {
        // Arquivo não existe, criar novo
      }

      existingReports.push(report);

      // Manter apenas os últimos 100 relatórios por dia
      if (existingReports.length > 100) {
        existingReports = existingReports.slice(-100);
      }

      await fs.writeFile(filepath, JSON.stringify(existingReports, null, 2));
    } catch (error) {
      console.error('[SessionMonitor] Failed to save health report:', error.message);
    }
  }

  updateStats() {
    this.stats.totalSessions = this.sessions.size;
    this.stats.activeSessions = Array.from(this.sessions.values())
      .filter(session => ['ready', 'connected'].includes(session.status)).length;
    this.stats.failedSessions = Array.from(this.sessions.values())
      .filter(session => session.status === 'failed').length;
    this.stats.lastUpdate = new Date();
  }

  getStats() {
    return { ...this.stats };
  }

  getSessionDetails(sessionId) {
    const sessionInfo = this.sessions.get(sessionId);
    if (!sessionInfo) {
      return null;
    }

    return {
      sessionId: sessionInfo.sessionId,
      status: sessionInfo.status,
      registeredAt: sessionInfo.registeredAt,
      lastSeen: sessionInfo.lastSeen,
      reconnectCount: sessionInfo.reconnectCount,
      metrics: { ...sessionInfo.metrics },
      recentErrors: sessionInfo.errors.slice(-5) // Últimos 5 erros
    };
  }

  getAllSessions() {
    return Array.from(this.sessions.keys()).map(sessionId => 
      this.getSessionDetails(sessionId)
    );
  }

  async generateDetailedReport() {
    const stats = this.getStats();
    const sessions = this.getAllSessions();

    return {
      timestamp: new Date(),
      stats,
      sessions,
      systemInfo: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };
  }
}

// Singleton instance
const sessionMonitor = new SessionMonitor();

module.exports = sessionMonitor; 
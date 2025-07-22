const { sessionMonitor, sessionCleaner } = require('../sessions')

// Helper function for error responses
const sendErrorResponse = (res, statusCode, message) => {
  res.status(statusCode).json({
    success: false,
    error: message
  })
}

/**
 * Get system health and session statistics
 */
const getSystemHealth = async (req, res) => {
  try {
    const stats = sessionMonitor.getStats()
    const cleanerStats = sessionCleaner.getStats()
    const sessions = sessionMonitor.getAllSessions()
    
    const healthSummary = {
      timestamp: new Date(),
      status: stats.failedSessions === 0 ? 'healthy' : stats.failedSessions < stats.totalSessions * 0.5 ? 'degraded' : 'critical',
      sessionMonitor: {
        ...stats,
        healthyPercentage: stats.totalSessions > 0 ? Math.round((stats.activeSessions / stats.totalSessions) * 100) : 0
      },
      sessionCleaner: cleanerStats,
      systemInfo: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version
      },
      recentSessions: sessions.slice(-5) // Últimas 5 sessões
    }
    
    res.json({
      success: true,
      result: healthSummary
    })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Get detailed session information
 */
const getSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params
    
    if (!sessionId) {
      return sendErrorResponse(res, 400, 'Session ID is required')
    }
    
    const sessionDetails = sessionMonitor.getSessionDetails(sessionId)
    
    if (!sessionDetails) {
      return sendErrorResponse(res, 404, 'Session not found')
    }
    
    res.json({
      success: true,
      result: sessionDetails
    })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Get all sessions status
 */
const getAllSessions = async (req, res) => {
  try {
    const sessions = sessionMonitor.getAllSessions()
    
    res.json({
      success: true,
      result: sessions,
      metadata: {
        total: sessions.length,
        healthy: sessions.filter(s => s.status === 'ready' || s.status === 'connected').length,
        unhealthy: sessions.filter(s => s.status === 'failed' || s.status === 'disconnected').length
      }
    })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Force reconnect a specific session
 */
const forceReconnectSession = async (req, res) => {
  try {
    const { sessionId } = req.params
    
    if (!sessionId) {
      return sendErrorResponse(res, 400, 'Session ID is required')
    }
    
    const sessionDetails = sessionMonitor.getSessionDetails(sessionId)
    
    if (!sessionDetails) {
      return sendErrorResponse(res, 404, 'Session not found')
    }
    
    // Trigger force reconnect
    sessionMonitor.emit('session:force_reconnect', sessionId)
    
    res.json({
      success: true,
      message: `Force reconnect triggered for session ${sessionId}`
    })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Trigger manual cleanup
 */
const triggerCleanup = async (req, res) => {
  try {
    const cleanupReport = await sessionCleaner.forceCleanup()
    
    res.json({
      success: true,
      message: 'Cleanup completed',
      result: cleanupReport
    })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Get detailed monitoring report
 */
const getDetailedReport = async (req, res) => {
  try {
    const report = await sessionMonitor.generateDetailedReport()
    
    res.json({
      success: true,
      result: report
    })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Get connection stability metrics
 */
const getConnectionMetrics = async (req, res) => {
  try {
    const sessions = sessionMonitor.getAllSessions()
    const now = new Date()
    
    const metrics = {
      timestamp: now,
      overall: {
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => ['ready', 'connected'].includes(s.status)).length,
        averageUptime: 0,
        totalReconnections: sessions.reduce((sum, s) => sum + s.reconnectCount, 0)
      },
      stability: {
        sessionsWithZeroReconnects: sessions.filter(s => s.reconnectCount === 0).length,
        sessionsWithLowReconnects: sessions.filter(s => s.reconnectCount > 0 && s.reconnectCount <= 3).length,
        sessionsWithHighReconnects: sessions.filter(s => s.reconnectCount > 3).length,
        averageReconnectsPerSession: sessions.length > 0 ? 
          sessions.reduce((sum, s) => sum + s.reconnectCount, 0) / sessions.length : 0
      },
      performance: {
        averageMessageThroughput: 0,
        peakConnections: sessions.length,
        systemLoad: process.cpuUsage(),
        memoryEfficiency: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
        }
      }
    }
    
    // Calcular uptime médio
    if (sessions.length > 0) {
      const totalUptime = sessions.reduce((sum, session) => {
        const uptime = now - new Date(session.registeredAt)
        return sum + uptime
      }, 0)
      metrics.overall.averageUptime = Math.round(totalUptime / sessions.length / 1000) // em segundos
    }
    
    res.json({
      success: true,
      result: metrics
    })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Get system alerts and warnings
 */
const getSystemAlerts = async (req, res) => {
  try {
    const sessions = sessionMonitor.getAllSessions()
    const alerts = []
    
    // Verificar sessões com muitas reconexões
    sessions.forEach(session => {
      if (session.reconnectCount > 5) {
        alerts.push({
          type: 'warning',
          sessionId: session.sessionId,
          message: `Session has ${session.reconnectCount} reconnections`,
          severity: session.reconnectCount > 10 ? 'high' : 'medium',
          timestamp: new Date()
        })
      }
      
      // Verificar sessões inativas por muito tempo
      const timeSinceLastSeen = new Date() - new Date(session.lastSeen)
      if (timeSinceLastSeen > 10 * 60 * 1000) { // 10 minutos
        alerts.push({
          type: 'error',
          sessionId: session.sessionId,
          message: `Session inactive for ${Math.round(timeSinceLastSeen / 1000 / 60)} minutes`,
          severity: 'high',
          timestamp: new Date()
        })
      }
    })
    
    // Verificar uso de memória
    const memUsage = process.memoryUsage()
    const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100
    
    if (memPercentage > 80) {
      alerts.push({
        type: 'warning',
        message: `High memory usage: ${Math.round(memPercentage)}%`,
        severity: memPercentage > 90 ? 'high' : 'medium',
        timestamp: new Date()
      })
    }
    
    res.json({
      success: true,
      result: {
        alerts,
        summary: {
          total: alerts.length,
          high: alerts.filter(a => a.severity === 'high').length,
          medium: alerts.filter(a => a.severity === 'medium').length,
          low: alerts.filter(a => a.severity === 'low').length
        }
      }
    })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

module.exports = {
  getSystemHealth,
  getSessionDetails,
  getAllSessions,
  forceReconnectSession,
  triggerCleanup,
  getDetailedReport,
  getConnectionMetrics,
  getSystemAlerts
} 
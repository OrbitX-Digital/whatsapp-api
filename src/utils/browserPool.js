/**
 * ================================================================
 * SISTEMA DE POOL DE BROWSERS PARA MÚLTIPLAS SESSÕES WHATSAPP
 * ================================================================
 * 
 * Este sistema gerencia eficientemente múltiplas instâncias de browser
 * para permitir conexões simultâneas de diferentes números de WhatsApp
 * 
 * Características:
 * - Isolamento completo entre sessões
 * - Reutilização inteligente de recursos
 * - Cleanup automático
 * - Monitoramento de recursos
 */

const puppeteer = require('puppeteer');
const { getIsolatedSessionConfig } = require('../config/puppeteerConfig');

class BrowserPool {
  constructor(options = {}) {
    this.maxBrowsers = options.maxBrowsers || 10; // Máximo de browsers simultâneos
    this.browsers = new Map(); // sessionId -> browser instance
    this.browserStatus = new Map(); // sessionId -> status info
    this.inUse = new Set(); // browsers atualmente em uso
    this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutos
    
    // Estatísticas
    this.stats = {
      created: 0,
      destroyed: 0,
      reused: 0,
      errors: 0
    };
    
    // Iniciar limpeza automática
    this.startCleanupTask();
    
    console.log(`[BrowserPool] Iniciado - Máximo: ${this.maxBrowsers} browsers`);
  }

  /**
   * Obter browser para uma sessão específica
   */
  async getBrowserForSession(sessionId) {
    try {
      // Verificar se já existe browser ativo para esta sessão
      if (this.browsers.has(sessionId)) {
        const existingBrowser = this.browsers.get(sessionId);
        const status = this.browserStatus.get(sessionId);
        
        // Verificar se o browser ainda está funcional
        if (await this.isBrowserHealthy(existingBrowser)) {
          console.log(`[BrowserPool] Reutilizando browser para sessão: ${sessionId}`);
          this.stats.reused++;
          this.inUse.add(sessionId);
          
          // Atualizar timestamp de último uso
          status.lastUsed = Date.now();
          this.browserStatus.set(sessionId, status);
          
          return existingBrowser;
        } else {
          // Browser não está saudável, remover e criar novo
          console.log(`[BrowserPool] Browser não saudável para ${sessionId}, removendo...`);
          await this.destroyBrowserForSession(sessionId);
        }
      }
      
      // Verificar limite de browsers
      if (this.browsers.size >= this.maxBrowsers) {
        // Tentar liberar um browser menos usado
        const freedSession = await this.freeOldestBrowser();
        if (!freedSession) {
          throw new Error(`Limite de browsers atingido (${this.maxBrowsers})`);
        }
        console.log(`[BrowserPool] Liberado browser da sessão ${freedSession} para criar novo`);
      }
      
      // Criar novo browser isolado para esta sessão
      const browser = await this.createIsolatedBrowser(sessionId);
      
      // Registrar o browser
      this.browsers.set(sessionId, browser);
      this.browserStatus.set(sessionId, {
        created: Date.now(),
        lastUsed: Date.now(),
        sessionId,
        pid: browser.process()?.pid || 'unknown'
      });
      this.inUse.add(sessionId);
      this.stats.created++;
      
      console.log(`[BrowserPool] Novo browser criado para sessão: ${sessionId} (PID: ${browser.process()?.pid})`);
      
      return browser;
      
    } catch (error) {
      console.error(`[BrowserPool] Erro ao obter browser para ${sessionId}:`, error.message);
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Criar browser isolado para sessão específica
   */
  async createIsolatedBrowser(sessionId) {
    const config = getIsolatedSessionConfig(sessionId);
    
    console.log(`[BrowserPool] Criando browser isolado para ${sessionId}...`);
    console.log(`[BrowserPool] UserDataDir: ${config.userDataDir}`);
    
    const browser = await puppeteer.launch(config);
    
    // Configurar handlers de eventos
    browser.on('disconnected', () => {
      console.log(`[BrowserPool] Browser desconectado para sessão: ${sessionId}`);
      this.browsers.delete(sessionId);
      this.browserStatus.delete(sessionId);
      this.inUse.delete(sessionId);
    });
    
    browser.on('targetcreated', () => {
      console.log(`[BrowserPool] Nova aba criada para sessão: ${sessionId}`);
    });
    
    return browser;
  }

  /**
   * Verificar se o browser está saudável
   */
  async isBrowserHealthy(browser) {
    try {
      if (!browser || !browser.isConnected()) {
        return false;
      }
      
      // Testar criação de página
      const page = await browser.newPage();
      await page.close();
      
      return true;
    } catch (error) {
      console.warn(`[BrowserPool] Health check falhou:`, error.message);
      return false;
    }
  }

  /**
   * Liberar browser de uma sessão
   */
  async releaseBrowserForSession(sessionId) {
    try {
      this.inUse.delete(sessionId);
      
      if (this.browserStatus.has(sessionId)) {
        const status = this.browserStatus.get(sessionId);
        status.lastUsed = Date.now();
        this.browserStatus.set(sessionId, status);
      }
      
      console.log(`[BrowserPool] Browser liberado para sessão: ${sessionId}`);
    } catch (error) {
      console.error(`[BrowserPool] Erro ao liberar browser ${sessionId}:`, error.message);
    }
  }

  /**
   * Destruir browser de uma sessão específica
   */
  async destroyBrowserForSession(sessionId) {
    try {
      if (this.browsers.has(sessionId)) {
        const browser = this.browsers.get(sessionId);
        
        // Fechar todas as páginas primeiro
        const pages = await browser.pages();
        for (const page of pages) {
          try {
            await page.close();
          } catch (error) {
            console.warn(`[BrowserPool] Erro ao fechar página:`, error.message);
          }
        }
        
        // Fechar o browser
        await browser.close();
        
        // Limpar registros
        this.browsers.delete(sessionId);
        this.browserStatus.delete(sessionId);
        this.inUse.delete(sessionId);
        this.stats.destroyed++;
        
        console.log(`[BrowserPool] Browser destruído para sessão: ${sessionId}`);
      }
    } catch (error) {
      console.error(`[BrowserPool] Erro ao destruir browser ${sessionId}:`, error.message);
    }
  }

  /**
   * Liberar o browser mais antigo não utilizado
   */
  async freeOldestBrowser() {
    let oldestSession = null;
    let oldestTime = Date.now();
    
    for (const [sessionId, status] of this.browserStatus.entries()) {
      if (!this.inUse.has(sessionId) && status.lastUsed < oldestTime) {
        oldestTime = status.lastUsed;
        oldestSession = sessionId;
      }
    }
    
    if (oldestSession) {
      await this.destroyBrowserForSession(oldestSession);
      return oldestSession;
    }
    
    return null;
  }

  /**
   * Limpeza automática de browsers inativos
   */
  startCleanupTask() {
    setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        console.error('[BrowserPool] Erro na limpeza automática:', error.message);
      }
    }, this.cleanupInterval);
  }

  /**
   * Executar limpeza de browsers inativos
   */
  async performCleanup() {
    const now = Date.now();
    const maxIdleTime = 1800000; // 30 minutos
    const sessionsToClean = [];
    
    for (const [sessionId, status] of this.browserStatus.entries()) {
      const idleTime = now - status.lastUsed;
      
      if (!this.inUse.has(sessionId) && idleTime > maxIdleTime) {
        sessionsToClean.push(sessionId);
      }
    }
    
    if (sessionsToClean.length > 0) {
      console.log(`[BrowserPool] Limpando ${sessionsToClean.length} browsers inativos...`);
      
      for (const sessionId of sessionsToClean) {
        await this.destroyBrowserForSession(sessionId);
      }
    }
  }

  /**
   * Destruir todos os browsers
   */
  async destroyAll() {
    console.log(`[BrowserPool] Destruindo todos os browsers (${this.browsers.size})...`);
    
    const destroyPromises = Array.from(this.browsers.keys()).map(sessionId => 
      this.destroyBrowserForSession(sessionId)
    );
    
    await Promise.all(destroyPromises);
    
    console.log('[BrowserPool] Todos os browsers destruídos');
  }

  /**
   * Obter estatísticas do pool
   */
  getStats() {
    return {
      ...this.stats,
      active: this.browsers.size,
      inUse: this.inUse.size,
      maxBrowsers: this.maxBrowsers,
      sessions: Array.from(this.browserStatus.values())
    };
  }

  /**
   * Obter informações detalhadas
   */
  getDetailedInfo() {
    const sessions = Array.from(this.browserStatus.entries()).map(([sessionId, status]) => ({
      sessionId,
      ...status,
      inUse: this.inUse.has(sessionId),
      idleTime: Date.now() - status.lastUsed
    }));
    
    return {
      stats: this.getStats(),
      sessions,
      memoryUsage: process.memoryUsage()
    };
  }
}

// Instância singleton do pool
let browserPoolInstance = null;

const getBrowserPool = (options) => {
  if (!browserPoolInstance) {
    browserPoolInstance = new BrowserPool(options);
  }
  return browserPoolInstance;
};

module.exports = {
  BrowserPool,
  getBrowserPool
}; 
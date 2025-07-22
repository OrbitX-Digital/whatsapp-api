const EventEmitter = require('events');

class ConnectionManager extends EventEmitter {
  constructor(sessionId, createClientFunction) {
    super();
    this.sessionId = sessionId;
    this.createClientFunction = createClientFunction;
    this.client = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseReconnectDelay = 2000; // 2 segundos
    this.maxReconnectDelay = 60000; // 1 minuto
    this.reconnectTimer = null;
    this.healthCheckTimer = null;
    this.isDestroyed = false;
    this.lastConnectedTime = null;
    this.connectionState = 'disconnected';
    
    // Configurações de health check
    this.healthCheckInterval = 30000; // 30 segundos
    this.connectionTimeout = 60000; // 1 minuto
    this.lastHealthCheck = Date.now();
    
    this.bindEvents();
  }

  bindEvents() {
    this.on('connection:lost', this.handleConnectionLost.bind(this));
    this.on('connection:restored', this.handleConnectionRestored.bind(this));
    this.on('health:check', this.performHealthCheck.bind(this));
  }

  async connect() {
    if (this.isDestroyed) {
      console.log(`[${this.sessionId}] Connection manager destroyed, aborting connection`);
      return;
    }

    try {
      console.log(`[${this.sessionId}] Attempting to connect... (attempt ${this.reconnectAttempts + 1})`);
      this.connectionState = 'connecting';
      
      // Criar novo cliente
      const result = this.createClientFunction(this.sessionId);
      if (!result.success) {
        throw new Error(result.message);
      }
      
      this.client = result.client;
      this.setupClientEventListeners();
      
      // Aguardar inicialização
      await this.waitForConnection();
      
      this.connectionState = 'connected';
      this.lastConnectedTime = Date.now();
      this.reconnectAttempts = 0;
      
      console.log(`[${this.sessionId}] Successfully connected!`);
      this.emit('connection:restored');
      
      // Iniciar health check
      this.startHealthCheck();
      
      return true;
    } catch (error) {
      console.error(`[${this.sessionId}] Connection failed:`, error.message);
      this.connectionState = 'failed';
      this.handleConnectionFailure(error);
      return false;
    }
  }

  setupClientEventListeners() {
    if (!this.client) return;

    // Monitorar estado da conexão
    this.client.on('change_state', (state) => {
      console.log(`[${this.sessionId}] State changed to: ${state}`);
      if (state === 'CONNECTED') {
        this.connectionState = 'connected';
        this.lastHealthCheck = Date.now();
      } else if (state === 'DISCONNECTED') {
        this.emit('connection:lost', 'state_changed');
      }
    });

    this.client.on('disconnected', (reason) => {
      console.log(`[${this.sessionId}] Disconnected:`, reason);
      this.emit('connection:lost', reason);
    });

    this.client.on('auth_failure', () => {
      console.error(`[${this.sessionId}] Authentication failed`);
      this.emit('connection:lost', 'auth_failure');
    });

    // Monitorar página do Puppeteer
    this.client.pupPage?.on('close', () => {
      console.log(`[${this.sessionId}] Browser page closed`);
      this.emit('connection:lost', 'page_closed');
    });

    this.client.pupPage?.on('error', (error) => {
      console.error(`[${this.sessionId}] Browser page error:`, error.message);
      this.emit('connection:lost', 'page_error');
    });
  }

  async waitForConnection(timeout = this.connectionTimeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);

      const checkConnection = () => {
        if (this.client && this.client.info && this.client.info.wid) {
          clearTimeout(timeoutId);
          resolve();
        } else {
          setTimeout(checkConnection, 1000);
        }
      };

      checkConnection();
    });
  }

  handleConnectionLost(reason) {
    console.log(`[${this.sessionId}] Connection lost: ${reason}`);
    this.connectionState = 'disconnected';
    this.stopHealthCheck();
    
    if (!this.isDestroyed) {
      this.scheduleReconnect();
    }
  }

  handleConnectionRestored() {
    console.log(`[${this.sessionId}] Connection restored`);
    this.connectionState = 'connected';
    this.lastConnectedTime = Date.now();
  }

  handleConnectionFailure(error) {
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[${this.sessionId}] Max reconnect attempts reached. Giving up.`);
      this.connectionState = 'failed';
      this.emit('connection:failed', error);
      return;
    }

    this.scheduleReconnect();
  }

  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Retry exponencial com jitter
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    
    // Adicionar jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    const finalDelay = delay + jitter;

    console.log(`[${this.sessionId}] Scheduling reconnect in ${Math.round(finalDelay / 1000)}s`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, finalDelay);
  }

  startHealthCheck() {
    this.stopHealthCheck(); // Limpar existente
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);
  }

  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  async performHealthCheck() {
    if (!this.client || this.connectionState !== 'connected') {
      return;
    }

    try {
      // Verificar se a página ainda está ativa
      if (this.client.pupPage && this.client.pupPage.isClosed()) {
        throw new Error('Browser page is closed');
      }

      // Tentar executar uma operação simples
      await Promise.race([
        this.client.pupPage?.evaluate('1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 5000))
      ]);

      // Verificar estado do cliente
      const state = await this.client.getState();
      if (state !== 'CONNECTED') {
        throw new Error(`Client state is ${state}`);
      }

      this.lastHealthCheck = Date.now();
      console.log(`[${this.sessionId}] Health check passed`);
      
    } catch (error) {
      console.error(`[${this.sessionId}] Health check failed:`, error.message);
      this.emit('connection:lost', 'health_check_failed');
    }
  }

  async destroy() {
    console.log(`[${this.sessionId}] Destroying connection manager`);
    this.isDestroyed = true;
    this.connectionState = 'destroyed';
    
    // Limpar timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHealthCheck();
    
    // Destruir cliente
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (error) {
        console.error(`[${this.sessionId}] Error destroying client:`, error.message);
      }
      this.client = null;
    }
    
    this.removeAllListeners();
  }

  getConnectionInfo() {
    return {
      sessionId: this.sessionId,
      state: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      lastConnectedTime: this.lastConnectedTime,
      lastHealthCheck: this.lastHealthCheck,
      isDestroyed: this.isDestroyed
    };
  }

  async forceReconnect() {
    console.log(`[${this.sessionId}] Force reconnecting...`);
    this.reconnectAttempts = 0; // Reset attempts
    
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (error) {
        console.error(`[${this.sessionId}] Error destroying client during force reconnect:`, error);
      }
      this.client = null;
    }
    
    this.connect();
  }
}

module.exports = ConnectionManager; 
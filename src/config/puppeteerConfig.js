/**
 * Configurações otimizadas do Puppeteer para máxima estabilidade
 * Baseado nas melhores práticas e research de issues comuns
 */

// === FUNÇÃO PRINCIPAL PARA CONFIGURAÇÃO OTIMIZADA DO PUPPETEER ===
const getOptimalPuppeteerConfig = () => {
  return {
    headless: true, // Usar headless true (mais estável que 'new')
    executablePath: '/usr/bin/chromium-browser', // CRITICAL: Path para Chromium no Alpine Linux
    
    // === ARGUMENTOS OTIMIZADOS PARA ESTABILIDADE E PERFORMANCE ===
    args: [
      // === SEGURANÇA E SANDBOX ===
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      // REMOVIDO: '--single-process', // ← CAUSA CONFLITOS ENTRE MÚLTIPLAS INSTÂNCIAS
      '--disable-gpu',
      '--disable-software-rasterizer',
      
      // === OTIMIZAÇÕES DE MEMÓRIA ===
      '--max_old_space_size=2048',
      '--max-http-header-size=80000',
      '--memory-pressure-off',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      
      // === DESABILITAR RECURSOS DESNECESSÁRIOS ===
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-background-downloads',
      '--disable-add-to-shelf',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-features=AudioServiceOutOfProcess',
      '--disable-features=MediaRouter',
      '--disable-blink-features=AutomationControlled',
      '--disable-client-side-phishing-detection',
      
      // === ESPECÍFICOS PARA WHATSAPP-WEB.JS ===
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--autoplay-policy=user-gesture-required',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-field-trial-config',
      '--disable-ipc-flooding-protection',
      '--disable-component-extensions-with-background-pages',
      '--disable-datasaver-prompt',
      '--disable-desktop-notifications',
      '--disable-domain-reliability',
      '--disable-features=AudioServiceOutOfProcess,AudioServiceSandbox',
      '--disable-hang-monitor',
      '--disable-in-process-stack-traces',
      '--disable-prompt-on-repost',
      '--disable-speech-api',
      '--hide-crash-restore-bubble',
      '--metrics-recording-only',
      '--no-crash-upload',
      '--no-report-upload',
      '--skip-default-browser-check',
      
      // === OTIMIZAÇÕES ESPECÍFICAS PARA MÚLTIPLAS INSTÂNCIAS ===
      '--force-color-profile=srgb',
      '--disable-remote-fonts',
      '--disable-bundled-ppapi-flash',
      '--disable-plugins-discovery',
      '--disable-preconnect',
      '--disable-features=NetworkService',
      '--disable-background-networking',
      '--disable-sync',
      '--safebrowsing-disable-auto-update',
      
      // === CERTIFICADOS ===
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--ignore-certificate-errors-spki-list',
      '--ignore-certificate-errors-spki-list'
    ],
    
    // === CONFIGURAÇÕES AVANÇADAS ===
    defaultViewport: {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: true
    },
    
    // === TIMEOUTS OTIMIZADOS (AUMENTADOS PARA MÚLTIPLAS SESSÕES) ===
    timeout: 300000, // 5 minutos para inicialização de browser (múltiplas sessões)
    
    // === CONFIGURAÇÕES DE PROTOCOLO ===
    protocolTimeout: 480000, // 8 minutos para comandos complexos (múltiplas sessões)
    
    // === CONFIGURAÇÕES EXPERIMENTAIS ===
    ignoreDefaultArgs: false,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    
    // === CONFIGURAÇÕES DE PIPE ===
    pipe: false, // Usar WebSocket ao invés de pipe para melhor estabilidade
    
    // === CONFIGURAÇÕES DE DEBUGGING (apenas em desenvolvimento) ===
    devtools: false,
    slowMo: 0
  };
};

// Configurações específicas para diferentes ambientes
const getEnvironmentConfig = () => {
  const isDocker = process.env.DOCKER_ENV === 'true';
  const isProduction = process.env.NODE_ENV === 'production';
  
  const baseConfig = getOptimalPuppeteerConfig();
  
  if (isDocker) {
    // Configurações adicionais para Docker
    baseConfig.args.push(
      // REMOVIDO: '--no-zygote', // Já está incluído no baseConfig
      // REMOVIDO: '--single-process', // Removido para suportar múltiplas instâncias
      '--disable-gpu-memory-buffer-video-frames'
    );
    
    // Configurações específicas para container (MÚLTIPLAS SESSÕES)
    baseConfig.timeout = 400000; // 6.7 minutos em Docker (múltiplas sessões)
    baseConfig.protocolTimeout = 600000; // 10 minutos em Docker (múltiplas sessões)
  }
  
  if (!isProduction) {
    // Configurações de desenvolvimento
    baseConfig.devtools = false; // Manter false mesmo em dev para performance
    baseConfig.slowMo = 0;
  }
  
  return baseConfig;
};

// === NOVA FUNÇÃO: CONFIGURAÇÃO ISOLADA PARA CADA SESSÃO ===
const getIsolatedSessionConfig = (sessionId) => {
  const baseConfig = getEnvironmentConfig();
  const fs = require('fs');
  const path = require('path');
  
  // Criar diretório único para cada sessão
  const sessionDir = path.join(process.cwd(), 'browser-sessions', sessionId);
  
  try {
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
  } catch (error) {
    console.warn(`[${sessionId}] Não foi possível criar diretório de sessão:`, error.message);
  }
  
  // Configuração isolada para esta sessão específica
  return {
    ...baseConfig,
    
    // === ISOLAMENTO CRÍTICO ===
    userDataDir: sessionDir, // Diretório único para cada sessão
    
    // === CONFIGURAÇÕES ESPECÍFICAS DA SESSÃO ===
    args: [
      ...baseConfig.args,
      `--user-data-dir=${sessionDir}`,
      `--remote-debugging-port=0`, // Porta dinâmica para evitar conflitos
      `--disable-features=ProcessPerSiteUpToMainFrameThreshold`, // Melhora isolamento
      `--process-per-site`, // Isolamento adicional por site
      `--site-per-process` // Máximo isolamento de segurança
    ],
    
    // === TIMEOUTS ESPECÍFICOS PARA MÚLTIPLAS INSTÂNCIAS ===
    timeout: baseConfig.timeout + (Math.random() * 10000), // Jitter para evitar conflitos
    protocolTimeout: baseConfig.protocolTimeout + (Math.random() * 30000),
    
    // === CONFIGURAÇÕES DE CONEXÃO ===
    pipe: false, // Sempre usar WebSocket para múltiplas instâncias
    
    // === CONFIGURAÇÕES EXPERIMENTAIS PARA ESTABILIDADE ===
    ignoreDefaultArgs: ['--disable-extensions'], // Permitir apenas extensões essenciais
    
    // === CONFIGURAÇÕES DE VIEWPORT ESPECÍFICAS ===
    defaultViewport: {
      ...baseConfig.defaultViewport,
      width: baseConfig.defaultViewport.width + (Math.floor(Math.random() * 100)), // Variação para simular diferentes dispositivos
      height: baseConfig.defaultViewport.height + (Math.floor(Math.random() * 50))
    }
  };
};

// Configurações de User Agent dinâmico
const getUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

// Configurações de retry para operações críticas
const getRetryConfig = () => {
  return {
    maxRetries: 3,
    retryDelay: 2000,
    exponentialBackoff: true,
    maxDelay: 10000
  };
};

// Configurações de timeout específicas
const getTimeoutConfig = () => {
  return {
    navigation: 30000, // 30s para navegação
    waitForSelector: 15000, // 15s para aguardar seletores
    waitForFunction: 10000, // 10s para aguardar funções
    screenshot: 5000, // 5s para screenshots
    evaluation: 30000 // 30s para avaliações
  };
};

module.exports = {
  getOptimalPuppeteerConfig,
  getEnvironmentConfig,
  getIsolatedSessionConfig,
  getUserAgent,
  getRetryConfig,
  getTimeoutConfig
}; 
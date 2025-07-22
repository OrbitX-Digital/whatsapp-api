const { Client, LocalAuth } = require('whatsapp-web.js')
const fs = require('fs')
const path = require('path')
const sessions = new Map()
const { baseWebhookURL, sessionFolderPath, maxAttachmentSize, setMessagesAsSeen, webVersion, webVersionCacheType, recoverSessions } = require('./config')
const { triggerWebhook, waitForNestedObject, checkIfEventisEnabled } = require('./utils')
const { exec } = require('child_process')
const ConnectionManager = require('./utils/connectionManager')
const { getEnvironmentConfig, getUserAgent } = require('./config/puppeteerConfig')
const sessionMonitor = require('./utils/sessionMonitor')
const SessionCleaner = require('./utils/sessionCleaner')

// === NOVO: IMPORTAR SISTEMA DE POOL DE BROWSERS ===
const { getBrowserPool } = require('./utils/browserPool')

// Inicializar o pool de browsers (otimizado para múltiplas sessões)
const browserPool = getBrowserPool({
  maxBrowsers: 25, // ✅ Aumentado para 25 sessões (compatível com WhatsApp Business API)
  cleanupInterval: 300000 // Limpeza a cada 5 minutos
})

// === SISTEMAS DE MONITORAMENTO (TEMPORARIAMENTE DESABILITADOS) ===
// const { ConnectionManager } = require('./utils/connectionManager')
// const { getEnvironmentConfig, getUserAgent } = require('./config/puppeteerConfig')
// const sessionMonitor = require('./utils/sessionMonitor')
// const SessionCleaner = require('./utils/sessionCleaner')

// Armazenamento das sessões
const connectionManagers = new Map()

// const sessionCleaner = new SessionCleaner({
//   checkInterval: 300000, // 5 minutos
//   maxIdleTime: 1800000, // 30 minutos
//   enableLogRotation: true,
//   maxLogSize: 50 * 1024 * 1024 // 50MB
// })

// // Inicializar sistemas
// sessionMonitor.start()
// sessionCleaner.start()

// // Listener para limpeza de sessões falhas
// sessionCleaner.on('session:cleanup', async (sessionId) => {
//   console.log(`[SessionCleaner] Limpando sessão falha: ${sessionId}`)
//   await deleteSession(sessionId)
// })

// Função auxiliar para configurar WebVersion cache
const getWebVersionCacheConfig = () => {
  if (!webVersion) {
    return { type: 'none' }
  }
  
  switch (webVersionCacheType.toLowerCase()) {
    case 'local':
      return { type: 'local' }
    case 'remote':
      return {
        type: 'remote',
        remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${webVersion}.html`
      }
    default:
      return { type: 'none' }
  }
}

// Function to validate if the session is ready
const validateSession = async (sessionId) => {
  try {
    const returnData = { success: false, state: null, message: '' }

    // Session not Connected 😢
    if (!sessions.has(sessionId) || !sessions.get(sessionId)) {
      returnData.message = 'session_not_found'
      return returnData
    }

    const client = sessions.get(sessionId)
    // wait until the client is created
    await waitForNestedObject(client, 'pupPage')
      .catch((err) => { return { success: false, state: null, message: err.message } })

    // Wait for client.pupPage to be evaluable
    let maxRetry = 0
    while (true) {
      try {
        if (client.pupPage.isClosed()) {
          return { success: false, state: null, message: 'browser tab closed' }
        }
        await Promise.race([
          client.pupPage.evaluate('1'),
          new Promise(resolve => setTimeout(resolve, 1000))
        ])
        break
      } catch (error) {
        if (maxRetry === 2) {
          return { success: false, state: null, message: 'session closed' }
        }
        maxRetry++
      }
    }

    const state = await client.getState()
    returnData.state = state
    if (state !== 'CONNECTED') {
      returnData.message = 'session_not_connected'
      return returnData
    }

    // Session Connected 🎉
    returnData.success = true
    returnData.message = 'session_connected'
    return returnData
  } catch (error) {
    console.log(error)
    return { success: false, state: null, message: error.message }
  }
}

// Function to handle client session restoration
const restoreSessions = () => {
  try {
    if (!fs.existsSync(sessionFolderPath)) {
      fs.mkdirSync(sessionFolderPath) // Create the session directory if it doesn't exist
    }
    // Read the contents of the folder
    fs.readdir(sessionFolderPath, (_, files) => {
      // Iterate through the files in the parent folder
      for (const file of files) {
        // Use regular expression to extract the string from the folder name
        const match = file.match(/^session-(.+)$/)
        if (match) {
          const sessionId = match[1]
          console.log('existing session detected', sessionId)
          setupSession(sessionId)
        }
      }
    })
  } catch (error) {
    console.log(error)
    console.error('Failed to restore sessions:', error)
  }
}

// Setup Session
const setupSession = (sessionId) => {
  try {
    console.log(`[${sessionId}] ===== INICIANDO CONFIGURAÇÃO DA SESSÃO =====`)
    
    // === VERIFICAÇÃO DE LIMITE DE SESSÕES SIMULTÂNEAS ===
    const MAX_CONCURRENT_SESSIONS = process.env.MAX_CONCURRENT_SESSIONS || 25
    const currentActiveSessions = Array.from(sessions.entries()).filter(([id, client]) => {
      return client && !client.pupPage?.isClosed()
    })
    
    if (currentActiveSessions.length >= MAX_CONCURRENT_SESSIONS && !sessions.has(sessionId)) {
      const message = `Limite máximo de sessões simultâneas atingido (${MAX_CONCURRENT_SESSIONS}). ` +
                     `Atualmente ativas: ${currentActiveSessions.length}. ` +
                     `Termine algumas sessões antes de criar uma nova.`
      console.log(`[${sessionId}] ❌ ${message}`)
      return { success: false, message: message }
    }
    
    // === VERIFICAÇÃO DE SESSÃO EXISTENTE ===
    if (sessions.has(sessionId)) {
      const existingClient = sessions.get(sessionId)
      console.log(`[${sessionId}] Sessão já existe, verificando status...`)

      // Se sessão existente está ativa, retornar ela
      if (existingClient && !existingClient.pupPage?.isClosed()) {
        console.log(`[${sessionId}] Retornando sessão ativa existente`)
        return { success: true, message: `Sessão já ativa para: ${sessionId}`, client: existingClient }
      } else {
        // Se sessão existe mas está morta, limpar e criar nova
        console.log(`[${sessionId}] Sessão existente está inativa, limpando...`)
        sessions.delete(sessionId)
        connectionManagers.delete(sessionId)
      }
    }

    // === NOVA VERIFICAÇÃO: SESSÕES POR NÚMERO VS SESSÕES TOTAIS ===
    const activeSessions = Array.from(sessions.entries()).filter(([id, client]) => {
      return client && !client.pupPage?.isClosed()
    })

    console.log(`[${sessionId}] Status atual do sistema:`)
    console.log(`  - Total de sessões ativas: ${activeSessions.length}`)
    console.log(`  - Sessões no pool de browsers: ${browserPool.getStats().active}`)

    if (activeSessions.length > 0) {
      console.log(`[${sessionId}] Sessões ativas detectadas:`)
      activeSessions.forEach(([id, client]) => {
        const phoneNumber = client.info?.wid?._serialized || 'número desconhecido'
        console.log(`  - Sessão ${id}: ${phoneNumber}`)
      })
      
      // Para múltiplos números diferentes, isso é NORMAL e ESPERADO
      console.log(`[${sessionId}] ✅ Sistema preparado para múltiplos números WhatsApp`)
    }

    // === CONFIGURAÇÃO ISOLADA DO CLIENTE ===
    console.log(`[${sessionId}] Configurando cliente isolado...`)
    
    // Configurações otimizadas para múltiplas instâncias
    const clientOptions = {
      authStrategy: new LocalAuth({
        clientId: sessionId,
        dataPath: sessionFolderPath
      }),
      
      // === CONFIGURAÇÃO ESPECÍFICA DO PUPPETEER ISOLADO ===
      puppeteer: {
        executablePath: '/usr/bin/chromium-browser', // CRITICAL: Chromium path
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-software-rasterizer'
        ],
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false
      },
      
      // === CONFIGURAÇÕES ESPECÍFICAS PARA MÚLTIPLAS SESSÕES ===
      restartOnAuthFail: true,
      takeoverOnConflict: false, // CRÍTICO: Não forçar takeover para múltiplos números
      takeoverTimeoutMs: 0,
      qrMaxRetries: 5,
      
      // === CONFIGURAÇÕES DE ESTABILIDADE ===
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
      },
      
      // === USER AGENT DINÂMICO ===
      userAgent: getUserAgent()
    }

    console.log(`[${sessionId}] Criando cliente WhatsApp com isolamento completo...`)
    const client = new Client(clientOptions)

    // === EVENTOS ESPECÍFICOS PARA MÚLTIPLAS SESSÕES ===
    
    // QR Code
    client.on('qr', (qr) => {
      console.log(`[${sessionId}] 📱 QR Code gerado para sessão isolada`)
      
      // === ARMAZENAR QR CODE NA SESSÃO PARA ENDPOINTS ===
      client.qr = qr
      console.log(`[${sessionId}] ✅ QR Code armazenado para acesso via API`)
      
      // sessionMonitor.registerSession(sessionId, client, { qrGenerated: true })
    })

    // Ready
    client.on('ready', () => {
      const phoneNumber = client.info?.wid?._serialized || sessionId
      console.log(`[${sessionId}] ✅ Cliente conectado: ${phoneNumber}`)
      console.log(`[${sessionId}] 🔗 Sessão isolada ativa e funcional`)
      
      // === LIMPAR QR CODE APÓS AUTENTICAÇÃO ===
      client.qr = null
      console.log(`[${sessionId}] 🗑️ QR Code removido (sessão autenticada)`)
      
      // Registrar no monitoramento
      // sessionMonitor.registerSession(sessionId, client, { 
      //   connected: true, 
      //   phoneNumber: phoneNumber,
      //   isolated: true 
      // })
    })

    // Authenticated
    client.on('authenticated', () => {
      console.log(`[${sessionId}] 🔐 Sessão autenticada com sucesso`)
      
      // === LIMPAR QR CODE APÓS AUTENTICAÇÃO ===
      client.qr = null
      console.log(`[${sessionId}] 🗑️ QR Code removido (autenticado)`)
    })

    // Auth failure
    client.on('auth_failure', (msg) => {
      console.error(`[${sessionId}] ❌ Falha na autenticação:`, msg)
    })

    // Disconnected
    client.on('disconnected', (reason) => {
      console.log(`[${sessionId}] 🔌 Cliente desconectado:`, reason)
      
      // Liberar browser do pool
      browserPool.releaseBrowserForSession(sessionId)
      
      // Remover da lista de sessões
      sessions.delete(sessionId)
      connectionManagers.delete(sessionId)
      
      // sessionMonitor.unregisterSession(sessionId)
    })

    // Message
    client.on('message', (message) => {
      console.log(`[${sessionId}] 📨 Nova mensagem recebida`)
    })

    // Error
    client.on('error', (error) => {
      console.error(`[${sessionId}] ❌ Erro no cliente:`, error.message)
    })

    // === INTEGRAÇÃO COM BROWSER POOL ===
    console.log(`[${sessionId}] Integrando com sistema de browser isolado...`)
    
    // Sobrescrever a inicialização do Puppeteer para usar nosso pool
    const originalInitialize = client.initialize.bind(client)
    client.initialize = async function() {
      try {
        console.log(`[${sessionId}] Obtendo browser isolado do pool...`)
        
        // Obter browser isolado do pool
        const browser = await browserPool.getBrowserForSession(sessionId)
        
        // Configurar o cliente para usar este browser específico
        client.pupBrowser = browser
        
        console.log(`[${sessionId}] Browser isolado configurado (PID: ${browser.process()?.pid})`)
        
        // Chamar inicialização original
        return await originalInitialize()
        
      } catch (error) {
        console.error(`[${sessionId}] Erro ao obter browser isolado:`, error.message)
        throw error
      }
    }

    // === CONFIGURAÇÃO DO CONNECTION MANAGER (DESABILITADO TEMPORARIAMENTE) ===
    // console.log(`[${sessionId}] Configurando gerenciador de conexão...`)
    // const connectionManager = new ConnectionManager(client, sessionId, {
    //   maxRetries: 5,
    //   initialDelay: 2000,
    //   maxDelay: 30000,
    //   backoffFactor: 2,
    //   jitter: true,
    //   healthCheckInterval: 60000
    // })

    // Armazenar referências
    sessions.set(sessionId, client)
    // connectionManagers.set(sessionId, connectionManager)

    console.log(`[${sessionId}] ✅ Configuração da sessão isolada concluída`)
    console.log(`[${sessionId}] 🎯 Pronto para conectar número WhatsApp independente`)

    // === INICIALIZAÇÃO AUTOMÁTICA DO CLIENTE ===
    console.log(`[${sessionId}] 🚀 Iniciando cliente WhatsApp automaticamente...`)
    
    // Inicializar o cliente de forma assíncrona (não bloquear a resposta)
    setImmediate(async () => {
      try {
        await client.initialize()
        console.log(`[${sessionId}] ✅ Cliente WhatsApp inicializado com sucesso`)
      } catch (initError) {
        console.error(`[${sessionId}] ❌ Erro na inicialização automática:`, initError.message)
        // Não remover a sessão, deixar para retry manual
      }
    })

    return { success: true, message: `Sessão isolada configurada: ${sessionId}`, client }

  } catch (error) {
    console.error(`[${sessionId}] ❌ Erro ao configurar sessão:`, error.message)
    console.error(`[${sessionId}] Stack trace:`, error.stack)
    
    // Limpeza em caso de erro
    sessions.delete(sessionId)
    connectionManagers.delete(sessionId)
    browserPool.releaseBrowserForSession(sessionId)
    
    return { success: false, message: error.message }
  }
}

const initializeEvents = (client, sessionId) => {
  // check if the session webhook is overridden
  const sessionWebhook = process.env[sessionId.toUpperCase() + '_WEBHOOK_URL'] || baseWebhookURL

  if (recoverSessions) {
    waitForNestedObject(client, 'pupPage').then(() => {
      const restartSession = async (sessionId) => {
        sessions.delete(sessionId)
        await client.destroy().catch(e => { })
        setupSession(sessionId)
      }
      client.pupPage.once('close', function () {
        // emitted when the page closes
        console.log(`Browser page closed for ${sessionId}. Restoring`)
        restartSession(sessionId)
      })
      client.pupPage.once('error', function () {
        // emitted when the page crashes
        console.log(`Error occurred on browser page for ${sessionId}. Restoring`)
        restartSession(sessionId)
      })
    }).catch(e => { })
  }

  checkIfEventisEnabled('auth_failure')
    .then(_ => {
      client.on('auth_failure', (msg) => {
        triggerWebhook(sessionWebhook, sessionId, 'status', { msg })
      })
    })

  checkIfEventisEnabled('authenticated')
    .then(_ => {
      client.on('authenticated', () => {
        triggerWebhook(sessionWebhook, sessionId, 'authenticated')
      })
    })

  checkIfEventisEnabled('call')
    .then(_ => {
      client.on('call', async (call) => {
        triggerWebhook(sessionWebhook, sessionId, 'call', { call })
      })
    })

  checkIfEventisEnabled('change_state')
    .then(_ => {
      client.on('change_state', state => {
        triggerWebhook(sessionWebhook, sessionId, 'change_state', { state })
      })
    })

  checkIfEventisEnabled('disconnected')
    .then(_ => {
      client.on('disconnected', (reason) => {
        triggerWebhook(sessionWebhook, sessionId, 'disconnected', { reason })
      })
    })

  checkIfEventisEnabled('group_join')
    .then(_ => {
      client.on('group_join', (notification) => {
        triggerWebhook(sessionWebhook, sessionId, 'group_join', { notification })
      })
    })

  checkIfEventisEnabled('group_leave')
    .then(_ => {
      client.on('group_leave', (notification) => {
        triggerWebhook(sessionWebhook, sessionId, 'group_leave', { notification })
      })
    })

  checkIfEventisEnabled('group_update')
    .then(_ => {
      client.on('group_update', (notification) => {
        triggerWebhook(sessionWebhook, sessionId, 'group_update', { notification })
      })
    })

  checkIfEventisEnabled('loading_screen')
    .then(_ => {
      client.on('loading_screen', (percent, message) => {
        triggerWebhook(sessionWebhook, sessionId, 'loading_screen', { percent, message })
      })
    })

  checkIfEventisEnabled('media_uploaded')
    .then(_ => {
      client.on('media_uploaded', (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'media_uploaded', { message })
      })
    })

  checkIfEventisEnabled('message')
    .then(_ => {
      client.on('message', async (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'message', { message })
        if (message.hasMedia && message._data?.size < maxAttachmentSize) {
          // custom service event
          checkIfEventisEnabled('media').then(_ => {
            message.downloadMedia().then(messageMedia => {
              triggerWebhook(sessionWebhook, sessionId, 'media', { messageMedia, message })
            }).catch(e => {
              console.log('Download media error:', e.message)
            })
          })
        }
        if (setMessagesAsSeen) {
          const chat = await message.getChat()
          chat.sendSeen()
        }
      })
    })

  checkIfEventisEnabled('message_ack')
    .then(_ => {
      client.on('message_ack', async (message, ack) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_ack', { message, ack })
        if (setMessagesAsSeen) {
          const chat = await message.getChat()
          chat.sendSeen()
        }
      })
    })

  checkIfEventisEnabled('message_create')
    .then(_ => {
      client.on('message_create', async (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_create', { message })
        if (setMessagesAsSeen) {
          const chat = await message.getChat()
          chat.sendSeen()
        }
      })
    })

  checkIfEventisEnabled('message_reaction')
    .then(_ => {
      client.on('message_reaction', (reaction) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_reaction', { reaction })
      })
    })

  checkIfEventisEnabled('message_edit')
    .then(_ => {
      client.on('message_edit', (message, newBody, prevBody) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_edit', { message, newBody, prevBody })
      })
    })

  checkIfEventisEnabled('message_ciphertext')
    .then(_ => {
      client.on('message_ciphertext', (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_ciphertext', { message })
      })
    })

  checkIfEventisEnabled('message_revoke_everyone')
    .then(_ => {
      // eslint-disable-next-line camelcase
      client.on('message_revoke_everyone', async (message) => {
        // eslint-disable-next-line camelcase
        triggerWebhook(sessionWebhook, sessionId, 'message_revoke_everyone', { message })
      })
    })

  checkIfEventisEnabled('message_revoke_me')
    .then(_ => {
      client.on('message_revoke_me', async (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_revoke_me', { message })
      })
    })

  client.on('qr', (qr) => {
    // inject qr code into session
    client.qr = qr
    checkIfEventisEnabled('qr')
      .then(_ => {
        triggerWebhook(sessionWebhook, sessionId, 'qr', { qr })
      })
  })

  checkIfEventisEnabled('ready')
    .then(_ => {
      client.on('ready', () => {
        triggerWebhook(sessionWebhook, sessionId, 'ready')
      })
    })

  checkIfEventisEnabled('contact_changed')
    .then(_ => {
      client.on('contact_changed', async (message, oldId, newId, isContact) => {
        triggerWebhook(sessionWebhook, sessionId, 'contact_changed', { message, oldId, newId, isContact })
      })
    })

  checkIfEventisEnabled('chat_removed')
    .then(_ => {
      client.on('chat_removed', async (chat) => {
        triggerWebhook(sessionWebhook, sessionId, 'chat_removed', { chat })
      })
    })

  checkIfEventisEnabled('chat_archived')
    .then(_ => {
      client.on('chat_archived', async (chat, currState, prevState) => {
        triggerWebhook(sessionWebhook, sessionId, 'chat_archived', { chat, currState, prevState })
      })
    })

  checkIfEventisEnabled('unread_count')
    .then(_ => {
      client.on('unread_count', async (chat) => {
        triggerWebhook(sessionWebhook, sessionId, 'unread_count', { chat })
      })
    })
}

// Function to delete client session folder
const deleteSessionFolder = async (sessionId) => {
  try {
    const targetDirPath = path.join(sessionFolderPath, `session-${sessionId}`)
    const resolvedTargetDirPath = await fs.promises.realpath(targetDirPath)
    const resolvedSessionPath = await fs.promises.realpath(sessionFolderPath)

    // Ensure the target directory path ends with a path separator
    const safeSessionPath = `${resolvedSessionPath}${path.sep}`

    // Validate the resolved target directory path is a subdirectory of the session folder path
    if (!resolvedTargetDirPath.startsWith(safeSessionPath)) {
      throw new Error('Invalid path: Directory traversal detected')
    }
    await fs.promises.rm(resolvedTargetDirPath, { recursive: true, force: true })
  } catch (error) {
    console.log('Folder deletion error', error)
    throw error
  }
}

// Function to reload client session without removing browser cache
const reloadSession = async (sessionId) => {
  try {
    const client = sessions.get(sessionId)
    if (!client) {
      return
    }
    // Check if pupPage exists before trying to remove listeners
    if (client.pupPage) {
      client.pupPage.removeAllListeners('close')
      client.pupPage.removeAllListeners('error')
    }
    try {
      if (client.pupBrowser) {
        const pages = await client.pupBrowser.pages()
        await Promise.all(pages.map((page) => page.close()))
        await Promise.race([
          client.pupBrowser.close(),
          new Promise(resolve => setTimeout(resolve, 5000))
        ])
      }
    } catch (e) {
      if (client.pupBrowser) {
        const childProcess = client.pupBrowser.process()
        if (childProcess) {
          childProcess.kill(9)
        }
      }
    }
    sessions.delete(sessionId)
    setupSession(sessionId)
  } catch (error) {
    console.log(error)
    throw error
  }
}

const deleteSession = async (sessionId) => {
  try {
    console.log(`[${sessionId}] ===== INICIANDO DELEÇÃO DA SESSÃO =====`)
    
    // === FASE 1: DESTRUIR CLIENTE E CONNECTION MANAGER ===
    if (sessions.has(sessionId)) {
      const client = sessions.get(sessionId)
      console.log(`[${sessionId}] Destruindo cliente WhatsApp...`)
      
      try {
        // Verificar se o cliente tem pupPage ativo
        if (client.pupPage && !client.pupPage.isClosed()) {
          console.log(`[${sessionId}] Fechando página do cliente...`)
          await client.pupPage.close()
        }
        
        // Verificar se o cliente tem pupBrowser ativo  
        if (client.pupBrowser && client.pupBrowser.isConnected()) {
          console.log(`[${sessionId}] Desconectando browser do cliente...`)
          // Não fechar aqui - será feito pelo browserPool
        }
        
        // Destruir o cliente
        console.log(`[${sessionId}] Executando logout e destroy do cliente...`)
        await client.logout()
        await client.destroy()
        
      } catch (error) {
        console.warn(`[${sessionId}] Erro ao destruir cliente (continuando):`, error.message)
      }
      
      // Remover da lista de sessões
      sessions.delete(sessionId)
      console.log(`[${sessionId}] ✅ Cliente removido da lista de sessões`)
    }

    // === FASE 2: DESTRUIR CONNECTION MANAGER ===
    if (connectionManagers.has(sessionId)) {
      const connectionManager = connectionManagers.get(sessionId)
      console.log(`[${sessionId}] Destruindo connection manager...`)
      
      try {
        if (connectionManager && typeof connectionManager.destroy === 'function') {
          await connectionManager.destroy()
        }
      } catch (error) {
        console.warn(`[${sessionId}] Erro ao destruir connection manager (continuando):`, error.message)
      }
      
      connectionManagers.delete(sessionId)
      console.log(`[${sessionId}] ✅ Connection manager removido`)
    }

    // === FASE 3: LIBERAR BROWSER DO POOL ===
    console.log(`[${sessionId}] Liberando browser do pool...`)
    try {
      await browserPool.destroyBrowserForSession(sessionId)
      console.log(`[${sessionId}] ✅ Browser liberado do pool`)
    } catch (error) {
      console.warn(`[${sessionId}] Erro ao liberar browser do pool (continuando):`, error.message)
    }

    // === FASE 4: REMOVER DO MONITORAMENTO ===
    // try {
    //   sessionMonitor.unregisterSession(sessionId)
    //   console.log(`[${sessionId}] ✅ Removido do monitoramento`)
    // } catch (error) {
    //   console.warn(`[${sessionId}] Erro ao remover do monitoramento (continuando):`, error.message)
    // }

    // === FASE 5: DELETAR PASTA DA SESSÃO ===
    const sessionPath = `${sessionFolderPath}/${sessionId}`
    console.log(`[${sessionId}] Removendo pasta da sessão: ${sessionPath}`)
    
    if (fs.existsSync(sessionPath)) {
      try {
        // Aguardar um pouco para garantir que todos os processos finalizaram
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Remover recursivamente
        await fs.promises.rm(sessionPath, { recursive: true, force: true })
        console.log(`[${sessionId}] ✅ Pasta da sessão removida`)
      } catch (error) {
        console.error(`[${sessionId}] ❌ Erro ao remover pasta da sessão:`, error.message)
        // Tentar forçar remoção
        try {
          const { exec } = require('child_process')
          await new Promise((resolve, reject) => {
            exec(`rm -rf "${sessionPath}"`, (error) => {
              if (error) reject(error)
              else resolve()
            })
          })
          console.log(`[${sessionId}] ✅ Pasta da sessão removida (forçado)`)
        } catch (forceError) {
          console.error(`[${sessionId}] ❌ Falha ao forçar remoção:`, forceError.message)
        }
      }
    } else {
      console.log(`[${sessionId}] ℹ️ Pasta da sessão não existe`)
    }

    // === FASE 6: LIMPEZA ADICIONAL DO BROWSER ===
    const browserSessionPath = `${process.cwd()}/browser-sessions/${sessionId}`
    console.log(`[${sessionId}] Removendo dados do browser: ${browserSessionPath}`)
    
    if (fs.existsSync(browserSessionPath)) {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000))
        await fs.promises.rm(browserSessionPath, { recursive: true, force: true })
        console.log(`[${sessionId}] ✅ Dados do browser removidos`)
      } catch (error) {
        console.warn(`[${sessionId}] Erro ao remover dados do browser (continuando):`, error.message)
      }
    }

    console.log(`[${sessionId}] ===== DELEÇÃO DA SESSÃO CONCLUÍDA =====`)
    console.log(`[${sessionId}] 🎯 Sessão completamente isolada e removida`)
    
    // Exibir estatísticas do pool após limpeza
    const poolStats = browserPool.getStats()
    console.log(`[SISTEMA] Browsers ativos após limpeza: ${poolStats.active}`)
    
    return { success: true, message: `Sessão ${sessionId} deletada com sucesso` }

  } catch (error) {
    console.error(`[${sessionId}] ❌ Erro durante deleção da sessão:`, error.message)
    console.error(`[${sessionId}] Stack trace:`, error.stack)
    
    // Tentar limpeza de emergência
    sessions.delete(sessionId)
    connectionManagers.delete(sessionId)
    browserPool.releaseBrowserForSession(sessionId)
    
    return { success: false, message: `Erro ao deletar sessão: ${error.message}` }
  }
}

// Function to clean WhatsApp Web cache
const cleanWhatsAppWebCache = async () => {
  try {
    const cachePath = path.join(process.cwd(), '.wwebjs_cache')
    if (fs.existsSync(cachePath)) {
      console.log('Cleaning WhatsApp Web cache...')
      await fs.promises.rm(cachePath, { recursive: true, force: true })
      console.log('WhatsApp Web cache cleaned successfully')
    }
  } catch (error) {
    console.log('Error cleaning WhatsApp Web cache:', error)
  }
}

// Função para matar todos os processos Chromium/Chrome relacionados a sessões
const killChromiumProcesses = async () => {
  return new Promise((resolve) => {
    let cmd = ''
    if (process.platform === 'win32') {
      // Windows: taskkill para chrome e chromium
      cmd = 'taskkill /F /IM chrome.exe /T & taskkill /F /IM chromium.exe /T'
    } else {
      // Linux/Mac: pkill para chrome e chromium
      cmd = "pkill -f 'chromium.*session-' || pkill -f 'chrome.*session-' || true"
    }
    console.log('Matando todos os processos Chromium/Chrome relacionados a sessões...')
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.log('Erro ao matar processos Chromium/Chrome:', error.message)
      } else {
        console.log('Processos Chromium/Chrome finalizados.')
      }
      resolve()
    })
  })
}

// Function to handle session flush
const flushSessions = async (deleteOnlyInactive) => {
  try {
    if (!deleteOnlyInactive) {
      // 1. Matar todos os processos Chromium/Chrome
      await killChromiumProcesses()
    }
    // Read the contents of the sessions folder
    const files = await fs.promises.readdir(sessionFolderPath)
    console.log(`Found ${files.length} files/folders in sessions directory`)
    
    if (!deleteOnlyInactive) {
      // If terminating all sessions, delete ALL session folders regardless of status
      console.log('Terminating ALL sessions - deleting all session folders')
      for (const file of files) {
        // Use regular expression to extract the string from the folder name
        const match = file.match(/^session-(.+)$/)
        if (match) {
          const sessionId = match[1]
          console.log(`Deleting session folder: ${sessionId}`)
          // Try to delete the session properly if it's active
          const validation = await validateSession(sessionId)
          if (validation.message !== 'session_not_found') {
            await deleteSession(sessionId)
          } else {
            // If session is not active, just delete the folder directly
            try {
              await deleteSessionFolder(sessionId)
              console.log(`Deleted orphaned session folder: ${sessionId}`)
            } catch (folderError) {
              console.log(`Error deleting orphaned session folder ${sessionId}:`, folderError.message)
            }
          }
        }
      }
      // Also delete any other files in the sessions folder (like message_log.txt)
      for (const file of files) {
        if (!file.match(/^session-/)) {
          try {
            const filePath = path.join(sessionFolderPath, file)
            await fs.promises.unlink(filePath)
            console.log(`Deleted file: ${file}`)
          } catch (fileError) {
            console.log(`Error deleting file ${file}:`, fileError.message)
          }
        }
      }
      // 2. Limpar cache do WhatsApp Web
      await cleanWhatsAppWebCache()
    } else {
      // Original logic for deleting only inactive sessions
      for (const file of files) {
        const match = file.match(/^session-(.+)$/)
        if (match) {
          const sessionId = match[1]
          const validation = await validateSession(sessionId)
          if (!validation.success) {
            await deleteSession(sessionId)
          }
        }
      }
    }
    console.log('Session flush completed successfully')
  } catch (error) {
    console.log('Session flush error:', error)
    throw error
  }
}

module.exports = {
  sessions,
  setupSession,
  restoreSessions,
  validateSession,
  deleteSession,
  reloadSession,
  flushSessions
}

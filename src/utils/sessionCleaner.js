const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class SessionCleaner {
  constructor(sessionFolderPath) {
    this.sessionFolderPath = sessionFolderPath;
    this.cleanupInterval = 30 * 60 * 1000; // 30 minutos
    this.cleanupTimer = null;
    this.isRunning = false;
    
    // Configurações de limpeza
    this.maxSessionAge = 24 * 60 * 60 * 1000; // 24 horas
    this.maxOrphanAge = 60 * 60 * 1000; // 1 hora
    this.maxTempFileAge = 30 * 60 * 1000; // 30 minutos
    this.maxLogFileSize = 50 * 1024 * 1024; // 50MB
  }

  start() {
    if (this.isRunning) {
      console.log('[SessionCleaner] Already running');
      return;
    }

    console.log('[SessionCleaner] Starting session cleanup service...');
    this.isRunning = true;
    this.scheduleNextCleanup();
  }

  stop() {
    if (!this.isRunning) {
      console.log('[SessionCleaner] Not running');
      return;
    }

    console.log('[SessionCleaner] Stopping session cleanup service...');
    this.isRunning = false;
    
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  scheduleNextCleanup() {
    if (!this.isRunning) return;

    this.cleanupTimer = setTimeout(() => {
      this.performCleanup();
      this.scheduleNextCleanup();
    }, this.cleanupInterval);
  }

  async performCleanup() {
    console.log('[SessionCleaner] Starting cleanup cycle...');
    
    const cleanupReport = {
      timestamp: new Date(),
      actions: [],
      stats: {
        orphanSessionsRemoved: 0,
        tempFilesRemoved: 0,
        logFilesRotated: 0,
        spaceSaved: 0
      }
    };

    try {
      // 1. Limpar sessões órfãs
      await this.cleanOrphanSessions(cleanupReport);
      
      // 2. Limpar arquivos temporários
      await this.cleanTempFiles(cleanupReport);
      
      // 3. Rotar logs grandes
      await this.rotateLogFiles(cleanupReport);
      
      // 4. Limpar cache do browser
      await this.cleanBrowserCache(cleanupReport);
      
      // 5. Limpar diretório .wwebjs_cache
      await this.cleanWwebjsCache(cleanupReport);
      
      console.log('[SessionCleaner] Cleanup completed:', cleanupReport.stats);
      
    } catch (error) {
      console.error('[SessionCleaner] Cleanup failed:', error.message);
      cleanupReport.actions.push({
        type: 'error',
        message: error.message,
        timestamp: new Date()
      });
    }

    return cleanupReport;
  }

  async cleanOrphanSessions(report) {
    try {
      if (!await this.directoryExists(this.sessionFolderPath)) {
        return;
      }

      const sessionDirs = await fs.readdir(this.sessionFolderPath);
      const now = Date.now();

      for (const dir of sessionDirs) {
        if (!dir.startsWith('session-')) continue;

        const sessionPath = path.join(this.sessionFolderPath, dir);
        const sessionId = dir.replace('session-', '');

        try {
          const stats = await fs.stat(sessionPath);
          const age = now - stats.mtime.getTime();

          // Verificar se é uma sessão órfã (muito antiga e sem atividade)
          if (age > this.maxOrphanAge) {
            // Verificar se há processos relacionados
            const hasActiveProcess = await this.checkForActiveProcess(sessionId);
            
            if (!hasActiveProcess) {
              console.log(`[SessionCleaner] Removing orphan session: ${sessionId}`);
              await this.removeDirectory(sessionPath);
              
              report.stats.orphanSessionsRemoved++;
              report.actions.push({
                type: 'orphan_session_removed',
                sessionId,
                path: sessionPath,
                age: Math.round(age / 1000 / 60), // idade em minutos
                timestamp: new Date()
              });
            }
          }
        } catch (error) {
          console.error(`[SessionCleaner] Error checking session ${sessionId}:`, error.message);
        }
      }
    } catch (error) {
      console.error('[SessionCleaner] Error cleaning orphan sessions:', error.message);
    }
  }

  async cleanTempFiles(report) {
    const tempDirs = [
      '/tmp',
      process.env.TMPDIR || '/tmp',
      path.join(process.cwd(), 'temp'),
      path.join(process.cwd(), 'tmp')
    ];

    for (const tempDir of tempDirs) {
      await this.cleanTempDirectory(tempDir, report);
    }
  }

  async cleanTempDirectory(tempDir, report) {
    try {
      if (!await this.directoryExists(tempDir)) {
        return;
      }

      const files = await fs.readdir(tempDir);
      const now = Date.now();

      for (const file of files) {
        // Procurar arquivos relacionados ao Chrome/Puppeteer
        if (file.includes('chrome') || file.includes('puppeteer') || file.includes('whatsapp')) {
          const filePath = path.join(tempDir, file);
          
          try {
            const stats = await fs.stat(filePath);
            const age = now - stats.mtime.getTime();

            if (age > this.maxTempFileAge) {
              console.log(`[SessionCleaner] Removing temp file: ${file}`);
              
              if (stats.isDirectory()) {
                await this.removeDirectory(filePath);
              } else {
                await fs.unlink(filePath);
              }

              report.stats.tempFilesRemoved++;
              report.stats.spaceSaved += stats.size || 0;
              report.actions.push({
                type: 'temp_file_removed',
                file,
                path: filePath,
                size: stats.size,
                timestamp: new Date()
              });
            }
          } catch (error) {
            // Arquivo pode ter sido removido por outro processo
          }
        }
      }
    } catch (error) {
      console.error(`[SessionCleaner] Error cleaning temp directory ${tempDir}:`, error.message);
    }
  }

  async rotateLogFiles(report) {
    const logFiles = [
      'logs/app.log',
      'logs/error.log',
      'logs/sessions.log'
    ];

    for (const logFile of logFiles) {
      await this.rotateLogFile(logFile, report);
    }
  }

  async rotateLogFile(logFilePath, report) {
    try {
      const fullPath = path.join(process.cwd(), logFilePath);
      
      if (!await this.fileExists(fullPath)) {
        return;
      }

      const stats = await fs.stat(fullPath);
      
      if (stats.size > this.maxLogFileSize) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const rotatedPath = `${fullPath}.${timestamp}`;
        
        console.log(`[SessionCleaner] Rotating log file: ${logFilePath}`);
        
        // Mover arquivo atual
        await fs.rename(fullPath, rotatedPath);
        
        // Criar novo arquivo vazio
        await fs.writeFile(fullPath, '');
        
        report.stats.logFilesRotated++;
        report.actions.push({
          type: 'log_file_rotated',
          originalPath: fullPath,
          rotatedPath,
          size: stats.size,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error(`[SessionCleaner] Error rotating log file ${logFilePath}:`, error.message);
    }
  }

  async cleanBrowserCache(report) {
    try {
      // Limpar cache do Chrome/Chromium usado pelo Puppeteer
      const cacheCommands = [
        'find /tmp -name "*chrome*" -type d -mtime +1 -exec rm -rf {} + 2>/dev/null || true',
        'find /tmp -name "*puppeteer*" -type d -mtime +1 -exec rm -rf {} + 2>/dev/null || true'
      ];

      for (const command of cacheCommands) {
        try {
          await execAsync(command);
        } catch (error) {
          // Ignorar erros (normal para find quando diretórios são removidos)
        }
      }

      report.actions.push({
        type: 'browser_cache_cleaned',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[SessionCleaner] Error cleaning browser cache:', error.message);
    }
  }

  async cleanWwebjsCache(report) {
    try {
      const cacheDir = path.join(process.cwd(), '.wwebjs_cache');
      
      if (!await this.directoryExists(cacheDir)) {
        return;
      }

      const cacheFiles = await fs.readdir(cacheDir);
      const now = Date.now();
      let filesRemoved = 0;
      let spaceFreed = 0;

      for (const file of cacheFiles) {
        const filePath = path.join(cacheDir, file);
        
        try {
          const stats = await fs.stat(filePath);
          const age = now - stats.mtime.getTime();

          // Remover arquivos de cache antigos (mais de 24 horas)
          if (age > this.maxSessionAge) {
            if (stats.isDirectory()) {
              await this.removeDirectory(filePath);
            } else {
              await fs.unlink(filePath);
            }
            
            filesRemoved++;
            spaceFreed += stats.size || 0;
          }
        } catch (error) {
          // Ignorar erros
        }
      }

      if (filesRemoved > 0) {
        report.stats.spaceSaved += spaceFreed;
        report.actions.push({
          type: 'wwebjs_cache_cleaned',
          filesRemoved,
          spaceFreed,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('[SessionCleaner] Error cleaning .wwebjs_cache:', error.message);
    }
  }

  async checkForActiveProcess(sessionId) {
    try {
      // Verificar se há processos Chrome/Node.js relacionados à sessão
      const { stdout } = await execAsync(`ps aux | grep -i "${sessionId}" | grep -v grep || true`);
      return stdout.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  async removeDirectory(dirPath) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      console.error(`[SessionCleaner] Error removing directory ${dirPath}:`, error.message);
    }
  }

  async directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  async fileExists(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch (error) {
      return false;
    }
  }

  async forceCleanup() {
    console.log('[SessionCleaner] Performing forced cleanup...');
    return await this.performCleanup();
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      cleanupInterval: this.cleanupInterval,
      maxSessionAge: this.maxSessionAge,
      maxOrphanAge: this.maxOrphanAge,
      maxTempFileAge: this.maxTempFileAge,
      maxLogFileSize: this.maxLogFileSize
    };
  }
}

module.exports = SessionCleaner; 
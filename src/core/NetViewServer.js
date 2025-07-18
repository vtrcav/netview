const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { ConfigManager } = require('../config/ConfigManager');
const { PingService } = require('../network/PingService');
const { DeviceStateManager } = require('../network/DeviceStateManager');
const { WhatsAppClient } = require('../notifications/WhatsAppClient');
const { NotificationManager } = require('../notifications/NotificationManager');
const { WebSocketHandler } = require('../websocket/WebSocketHandler');
const { TimerManager } = require('../utils/TimerManager');
const { CliManager } = require('../cli/CliManager');
const logger = require('../utils/Logger');
process.title = 'NetView';
class NetViewServer {
  constructor() {
    this.clients = new Set();
    this.deviceStates = {};
    this.pingInterval = 5;
    this.configWatchInterval = 10;
    this.deviceConfig = {};
    this.lastCheck = null;
    this.configFile = path.join(__dirname, '../../config/devices.json');
    this.timers = {};
    this.pingTasks = new Map();
    this.retryCount = 4;
    this.concurrentPings = 10;
    this.offlineNotifications = {};
    this.deviceOfflineHistory = {};
    this.NOTIFICATION_COOLDOWN = 30 * 60 * 1000;
    this.serverStartTime = Date.now();
    this.INITIAL_SCAN_DELAY = 60 * 1000;
    this.OFFLINE_THRESHOLD = null;
    this.notificationGroupId = null;
    this.configLastModified = 0;
    this.isReadyForNotifications = false;
    this.loadServerConfig();
    this.configManager = new ConfigManager(this);
    this.pingService = new PingService(this);
    this.deviceStateManager = new DeviceStateManager(this);
    this.whatsappClient = new WhatsAppClient(this);
    this.notificationManager = new NotificationManager(this);
    this.webSocketHandler = new WebSocketHandler(this);
    this.timerManager = new TimerManager(this);
    this.cliManager = new CliManager(this);
    logger.info(`Caminho do arquivo de configuração de dispositivos: ${this.configFile}`);
  }
  loadServerConfig() {
    const configPath = path.join(__dirname, '../../config/server.json');
    try {
      if (fs.existsSync(configPath)) {
        const rawConfig = fs.readFileSync(configPath, 'utf8');
        const serverConfig = JSON.parse(rawConfig);
        this.host = serverConfig.host || '0.0.0.0';
        this.port = serverConfig.port || 80;
        logger.info(`Configuração do servidor carregada: ${this.host}:${this.port}`);
      } else {
        this.host = '0.0.0.0';
        this.port = 80;
        const defaultConfig = JSON.stringify({ host: this.host, port: this.port }, null, 2);
        fs.writeFileSync(configPath, defaultConfig, 'utf8');
        logger.warn(`Arquivo config/server.json não encontrado. Criado com valores padrão (${this.host}:${this.port}).`);
      }
    } catch (error) {
      logger.error(`Erro ao carregar config/server.json. Usando valores padrão. Erro: ${error.message}`);
      this.host = '0.0.0.0';
      this.port = 80;
    }
  }
  async start(options = {}) {
    const isCliMode = options.cli || false;
    const app = express();
    app.use(express.static(path.join(__dirname, '../../public')));
    app.get('/assets/js/config.js', (req, res) => {
        const wsHost = req.hostname;
        const wsPort = this.port;
        res.set('Content-Type', 'application/javascript');
        res.send(`window.NETVIEW_CONFIG = { wsHost: '${wsHost}', wsPort: ${wsPort} };`);
    });
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });
    wss.on('connection', (ws, req) => {
        this.webSocketHandler.handleConnection(ws, req);
    });
    server.listen(this.port, this.host, async () => {
        const displayHost = this.host === '0.0.0.0' ? 'localhost' : this.host;
        logger.info(`Servidor NetView iniciado em ${this.host}:${this.port}`);
        logger.info(`Interface web disponível em: http://${displayHost}:${this.port}/`);

        await this.startBackgroundServices();

        if (isCliMode) {
            logger.info('Iniciando em modo CLI...');
            await this.cliManager.start();
        } else {
            logger.info('Iniciando em modo Servidor (background). A CLI interativa não será iniciada.');
            logger.info('Para gerenciamento, execute: node server.js --cli');
        }
    });
  }
  async startBackgroundServices() {
    logger.info('Iniciando serviços de background do NetView...');
    this.whatsappClient.loadGroupId();
    this.configManager.loadDeviceConfig();
    this.pingService.checkAllDevices();
    this.timerManager.setupTimers();
    logger.info('Serviços de background iniciados.');
    if (this.notificationGroupId) {
      logger.info('Grupo WhatsApp configurado. Tentando conectar automaticamente...');
      this.whatsappClient.initializeWhatsApp().catch(error => {
        logger.error(`Erro ao iniciar WhatsApp automaticamente: ${error.message}`);
      });
    } else {
      logger.info('Nenhum grupo WhatsApp configurado. Use o modo CLI para conectar e configurar um grupo.');
    }
  }
  isWhatsAppAvailable() {
    return this.whatsappClient.canSendNotifications();
  }
  getWhatsAppStatus() {
    return {
      status: this.whatsappClient.getConnectionStatus(),
      groupConfigured: !!this.notificationGroupId,
      canSendNotifications: this.isWhatsAppAvailable()
    };
  }
  setReadyForNotifications(isReady) {
    this.isReadyForNotifications = isReady;
    logger.info(`Pronto para notificações: ${isReady}`);
  }
}
module.exports = { NetViewServer };
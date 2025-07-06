const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');
const { ConfigManager } = require('../config/ConfigManager');
const { PingService } = require('../network/PingService');
const { DeviceStateManager } = require('../network/DeviceStateManager');
const { WhatsAppClient } = require('../notifications/WhatsAppClient');
const { NotificationManager } = require('../notifications/NotificationManager');
const { WebSocketHandler } = require('../websocket/WebSocketHandler');
const { TimerManager } = require('../utils/TimerManager');
const { CliManager } = require('../cli/CliManager');
const logger = require('../utils/Logger');
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
    this.MAX_CONSECUTIVE_OFFLINE_ALERTS = 3;
    this.serverStartTime = Date.now();
    this.INITIAL_SCAN_DELAY = 60 * 1000;
    this.OFFLINE_THRESHOLD = 15 * 1000;
    this.notificationGroupId = null;
    this.configLastModified = 0;
    this.isReadyForNotifications = false;
    this.configManager = new ConfigManager(this);
    this.pingService = new PingService(this);
    this.deviceStateManager = new DeviceStateManager(this);
    this.whatsappClient = new WhatsAppClient(this);
    this.notificationManager = new NotificationManager(this);
    this.webSocketHandler = new WebSocketHandler(this);
    this.timerManager = new TimerManager(this);
    this.cliManager = new CliManager(this);
    logger.info(`Caminho do arquivo de configuração: ${this.configFile}`);
    logger.info(`configLastModified inicializado como: ${this.configLastModified}`);
  }
  async startServices() {
    this.whatsappClient.loadGroupId();
    this.configManager.loadDeviceConfig();
    this.pingService.checkAllDevices();
    this.timerManager.setupTimers();
    await this.cliManager.start();
    logger.info('Servidor NetView inicializado');
    if (this.notificationGroupId) {
      logger.info('Grupo WhatsApp configurado. Tentando conectar automaticamente...');
      this.whatsappClient.initializeWhatsApp().catch(error => {
        logger.error(`Erro ao iniciar WhatsApp automaticamente: ${error.message}`);
      });
    } else {
      logger.info('Nenhum grupo WhatsApp configurado. Use o CLI para conectar e configurar um grupo.');
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
const port = process.argv[2] ? parseInt(process.argv[2]) : 80;
const host = process.argv[3] || '0.0.0.0';
const netViewServer = new NetViewServer();
const app = express();
app.use(express.static('public'));
app.get('/assets/js/config.js', (req, res) => {
  const wsHost = req.hostname || 'localhost';
  const wsPort = port;
  res.set('Content-Type', 'application/javascript');
  res.send(`window.NETVIEW_CONFIG = { wsHost: '${wsHost}', wsPort: ${wsPort} };`);
});
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
wss.on('connection', (ws, req) => {
  netViewServer.webSocketHandler.handleConnection(ws, req);
});
server.listen(port, host, () => {
  logger.info(`Servidor NetView iniciado em ${host}:${port}`);
  logger.info(`Interface web disponível em: http://${host}:${port}/`);
  netViewServer.startServices();
});
module.exports = { NetViewServer };
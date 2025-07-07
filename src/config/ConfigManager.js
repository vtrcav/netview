const fs = require('fs');
const logger = require('../utils/Logger');
class ConfigManager {
    constructor(server) {
        this.server = server;
    }
    loadDeviceConfig() {
        if (fs.existsSync(this.server.configFile)) {
            try {
                const jsonContent = fs.readFileSync(this.server.configFile, 'utf8');
                this.server.deviceConfig = JSON.parse(jsonContent);
                if (this.server.configLastModified === 0 || this.server.configLastModified === undefined) {
                    this.server.configLastModified = fs.statSync(this.server.configFile).mtimeMs;
                    logger.info(`configLastModified inicializado com mtime do arquivo: ${this.server.configLastModified}`);
                }
                logger.info(`Configuração de dispositivos carregada com sucesso. Total de dispositivos: ${Object.keys(this.server.deviceConfig).length}`);
                logger.info(`Novo deviceConfig: ${JSON.stringify(this.server.deviceConfig)}`);
            } catch (error) {
                logger.info(`Erro ao analisar o arquivo de configuração: ${error.message}`);
                this.server.deviceConfig = {};
            }
        } else {
            logger.info(`Arquivo de configuração não encontrado: ${this.server.configFile}`);
            this.server.deviceConfig = {};
        }
    }
    checkConfigUpdates() {
        logger.info(`Verificando atualizações no arquivo ${this.server.configFile}`);
        if (fs.existsSync(this.server.configFile)) {
            const currentMTime = fs.statSync(this.server.configFile).mtimeMs;
            logger.info(`currentMTime: ${currentMTime}, configLastModified: ${this.server.configLastModified}`);
            if (this.server.configLastModified === undefined) {
                logger.info(`configLastModified está undefined, inicializando com currentMTime: ${currentMTime}`);
                this.server.configLastModified = currentMTime;
            }
            if (currentMTime > this.server.configLastModified) {
                logger.info("Detectada alteração no arquivo de configuração. Recarregando...");
                const oldOfflineNotifications = { ...this.server.offlineNotifications };
                const oldDeviceOfflineHistory = { ...this.server.deviceOfflineHistory };
                const oldNotificationStates = {};
                if (this.server.deviceStates) {
                    for (const [category, devices] of Object.entries(this.server.deviceStates)) {
                        for (const device of devices) {
                            if (device.notificationSent) {
                                oldNotificationStates[device.name] = device.notificationSent;
                            }
                        }
                    }
                }
                this.server.deviceStates = {};
                this.server.offlineNotifications = {};
                this.server.deviceOfflineHistory = {};
                this.server.pingTasks.clear();
                this.server.configLastModified = currentMTime;
                this.loadDeviceConfig();
                const newOfflineNotifications = {};
                const newDeviceOfflineHistory = {};
                for (const deviceName in this.server.deviceConfig) {
                    if (oldOfflineNotifications[deviceName]) {
                        newOfflineNotifications[deviceName] = oldOfflineNotifications[deviceName];
                    }
                    if (oldDeviceOfflineHistory[deviceName]) {
                        newDeviceOfflineHistory[deviceName] = oldDeviceOfflineHistory[deviceName];
                    }
                }
                this.server.offlineNotifications = newOfflineNotifications;
                this.server.deviceOfflineHistory = newDeviceOfflineHistory;
                const notification = JSON.stringify({
                    type: 'config_updated',
                    timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(',', ''),
                    message: 'Configuração de dispositivos atualizada'
                });
                const groupedResults = this.server.deviceStates;
                let results = this.server.deviceStateManager.getAllDevices();
                const stats = {
                    total: results.length,
                    online: results.filter(item => item.status === 'Online').length,
                    offline: results.filter(item => item.status === 'Offline').length,
                    outOfHours: results.filter(item => item.status === 'Fora de horário').length,
                    checkDuration: 'Real-time'
                };
                const statusUpdate = JSON.stringify({
                    type: 'status_update',
                    timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
                    groups: groupedResults,
                    stats: stats
                });
                for (const client of this.server.clients) {
                    if (client.readyState === 1) {
                        client.send(notification);
                        client.send(statusUpdate);
                    }
                }
                logger.info("Iniciando verificação imediata dos dispositivos após atualização de configuração...");
                this.server.pingService.checkAllDevices();
            } else {
                logger.info("Nenhuma alteração detectada no arquivo de configuração.");
            }
        } else {
            logger.info(`Arquivo ${this.server.configFile} não encontrado durante verificação.`);
        }
    }
}
module.exports = { ConfigManager };
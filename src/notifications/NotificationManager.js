const logger = require('../utils/Logger');
const { formatDuration } = require('../utils/helpers');
class NotificationManager {
    constructor(server) {
        this.server = server;
    }
    async sendOfflineNotification(device) {
        if (!this.server.isReadyForNotifications) {
            logger.info(`[Notificação Offline] Ignorando ${device.name}: WhatsApp não está pronto.`);
            return;
        }
        logger.info(`[Notificação Offline] Iniciando verificação para ${device.name}.`);
        const now = Date.now();
        const deviceKey = device.name || device.ip;
        if (now - this.server.serverStartTime < this.server.INITIAL_SCAN_DELAY) {
            logger.info(`[Notificação Offline] Ignorando ${deviceKey}: dentro do período inicial de scan.`);
            return;
        }
        if (!this.server.offlineNotifications[deviceKey]) {
            this.server.offlineNotifications[deviceKey] = {
                notificationSent: false,
                firstOfflineTime: now,
                lastOfflineCheck: now
            };
            logger.info(`[Notificação Offline] Estado de notificação criado para ${deviceKey}.`);
        }
        if (!this.server.deviceOfflineHistory[deviceKey]) {
            this.server.deviceOfflineHistory[deviceKey] = {
                firstOfflineTime: now,
                wasOnlineBefore: true,
                isCurrentlyOffline: true
            };
            logger.info(`[Notificação Offline] Histórico de offline criado para ${deviceKey}.`);
        }
        const deviceNotification = this.server.offlineNotifications[deviceKey];
        const offlineHistory = this.server.deviceOfflineHistory[deviceKey];
        deviceNotification.lastOfflineCheck = now;
        if (offlineHistory.wasOnlineBefore) {
            offlineHistory.firstOfflineTime = now;
            offlineHistory.wasOnlineBefore = false;
            offlineHistory.isCurrentlyOffline = true;
            logger.info(`[Notificação Offline] ${deviceKey} ficou offline pela primeira vez.`);
        }
        const timeOffline = now - offlineHistory.firstOfflineTime;
        if (timeOffline < this.server.OFFLINE_THRESHOLD) {
            logger.info(`[Notificação Offline] ${deviceKey} ainda não atingiu o tempo mínimo offline (${timeOffline}ms < ${this.server.OFFLINE_THRESHOLD}ms).`);
            return;
        }
        logger.info(`[Notificação Offline] Verificando se a notificação deve ser enviada para ${deviceKey}. Sent: ${deviceNotification.notificationSent}, IsOffline: ${offlineHistory.isCurrentlyOffline}`);
        if (!deviceNotification.notificationSent && offlineHistory.isCurrentlyOffline) {
            logger.info(`[Notificação Offline] TENTANDO ENVIAR notificação para ${deviceKey}.`);
            try {
                const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                const message = `⚠️ *DISPOSITIVO OFFLINE* ⚠️\n\n` +
                              `*Nome:* ${device.name}\n` +
                              `*IP:* ${device.ip}\n` +
                              `*Descrição:* ${device.description || 'Sem descrição'}\n` +
                              `*Timestamp:* ${timestamp}\n`;
                await this.server.whatsappClient.sendMessage(message);
                deviceNotification.notificationSent = true;
                deviceNotification.notificationSentTime = now;
                logger.info(`✅ Notificação de offline ENVIADA para dispositivo: ${deviceKey}`);
            } catch (error) {
                logger.error(`❌ Erro ao enviar notificação de offline para ${deviceKey}:`, error);
            }
        } else if (deviceNotification.notificationSent) {
            logger.info(`[Notificação Offline] ${deviceKey} - Notificação já enviada anteriormente, ignorando.`);
        }
    }
    async sendOnlineNotification(device) {
        if (!this.server.isReadyForNotifications) {
            logger.info(`[Notificação Online] Ignorando ${device.name}: WhatsApp não está pronto.`);
            return;
        }
        const deviceKey = device.name || device.ip;
        const offlineHistory = this.server.deviceOfflineHistory[deviceKey];
        const deviceNotification = this.server.offlineNotifications[deviceKey];
        logger.info(`[Notificação Online] Iniciando verificação para ${deviceKey}.`);
        if (offlineHistory && offlineHistory.isCurrentlyOffline) {
            logger.info(`[Notificação Online] ${deviceKey} estava offline. Verificando se notificação foi enviada.`);
            if (deviceNotification && deviceNotification.notificationSent) {
                logger.info(`[Notificação Online] TENTANDO ENVIAR notificação para ${deviceKey}.`);
                try {
                    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                    const offlineDuration = formatDuration(Date.now() - offlineHistory.firstOfflineTime);
                    const message = `✅ *DISPOSITIVO ONLINE* ✅\n\n` +
                                  `*Nome:* ${device.name}\n` +
                                  `*IP:* ${device.ip}\n` +
                                  `*Descrição:* ${device.description || 'Sem descrição'}\n` +
                                  `*Timestamp:* ${timestamp}\n` +
                                  `*Tempo offline:* ${offlineDuration}`;
                    await this.server.whatsappClient.sendMessage(message);
                    logger.info(`✅ Notificação de online ENVIADA para dispositivo: ${deviceKey}`);
                } catch (error) {
                    logger.error(`❌ Erro ao enviar notificação de online para ${deviceKey}:`, error);
                }
            } else {
                logger.info(`[Notificação Online] ${deviceKey} voltou, mas notificação de offline não havia sido enviada. Nenhuma ação necessária.`);
            }
            this.resetDeviceNotificationState(deviceKey);
        } else {
            logger.info(`[Notificação Online] ${deviceKey} não precisava de notificação.`);
        }
    }
    resetDeviceNotificationState(deviceKey) {
        logger.info(`[Notificação] Resetando estado de notificação para dispositivo: ${deviceKey}`);
        if (this.server.offlineNotifications[deviceKey]) {
            delete this.server.offlineNotifications[deviceKey];
        }
        if (this.server.deviceOfflineHistory[deviceKey]) {
            delete this.server.deviceOfflineHistory[deviceKey];
        }
    }
}
module.exports = { NotificationManager };
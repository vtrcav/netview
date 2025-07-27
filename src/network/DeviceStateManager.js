const logger = require('../utils/Logger');
const { logStatusChange } = require('../utils/HistoryLogger');
class DeviceStateManager {
    constructor(server) {
        this.server = server;
    }
    async updateDeviceState(name, result) {
        result.timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const category = result.category || 'Outros';
        if (!this.server.deviceStates[category]) {
            this.server.deviceStates[category] = [];
        }
        const previousState = this.getDevicePreviousState(name, category);
        let updated = false;
        let statusChanged = false;
        let responseTimeChanged = false;

        this.server.deviceStates[category] = this.server.deviceStates[category].map(device => {
            if (device.name === name) {
                updated = true;
                statusChanged = device.status !== result.status;
                responseTimeChanged = device.responseTime !== result.responseTime;
                return result;
            }
            return device;
        });

        if (!updated) {
            this.server.deviceStates[category].push(result);
            statusChanged = true;
            responseTimeChanged = true;
        }

        if (statusChanged || responseTimeChanged) {
            logger.info(`Status do dispositivo ${name}: ${result.status} (mudou: ${statusChanged}, ms: ${responseTimeChanged})`);
            const update = JSON.stringify({
                type: 'device_update',
                device: result,
                timestamp: result.timestamp
            });
            for (const client of this.server.clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(update);
                }
            }
        }

        if (result.status === 'Offline') {
            this.server.notificationManager.sendOfflineNotification(result);
        } else if (result.status === 'Online' && statusChanged) {
            this.server.notificationManager.sendOnlineNotification(result);
        }

        if (statusChanged) {
            await logStatusChange(result.name, result.status);
            
            if (previousState) {
                const stateChange = JSON.stringify({
                    type: 'state_change',
                    device: result,
                    previous: previousState.status,
                    current: result.status,
                    timestamp: result.timestamp
                });
                for (const client of this.server.clients) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(stateChange);
                    }
                }
            }
            this.sendStatsToAll();
        }
    }
    sendStatsToAll() {
        for (const client of this.server.clients) {
            if (client.readyState === WebSocket.OPEN) {
                this.sendStats(client);
            }
        }
    }
    sendStats(ws) {
        const results = this.getAllDevices();
        const stats = {
            total: results.length,
            online: results.filter(item => item.status === 'Online').length,
            offline: results.filter(item => item.status === 'Offline').length,
            outOfHours: results.filter(item => item.status === 'Fora de horário').length,
            checkDuration: 'Real-time'
        };
        const response = {
            type: 'stats_update',
            timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
            stats: stats
        };
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(response));
        }
    }
    getAllDevices() {
        let results = [];
        for (const category in this.server.deviceStates) {
            results = results.concat(this.server.deviceStates[category]);
        }
        return results;
    }
    getDevicePreviousState(deviceName, category) {
        if (this.server.deviceStates[category]) {
            return this.server.deviceStates[category].find(device => device.name === deviceName) || null;
        }
        return null;
    }
}
module.exports = { DeviceStateManager };
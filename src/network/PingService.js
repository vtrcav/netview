const os = require('os');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);
const logger = require('../utils/Logger');
class PingService {
    constructor(server) {
        this.server = server;
    }
    async checkAllDevices() {
        const checkPromises = Object.entries(this.server.deviceConfig).map(
            ([name, info]) => this.checkDevice(name, info, false)
        );
        await this.runWithConcurrencyLimit(checkPromises, this.server.concurrentPings);
        logger.info("Verificação de todos os dispositivos concluída");
    }
    async runWithConcurrencyLimit(promiseFunctions, limit) {
        const batches = [];
        for (let i = 0; i < promiseFunctions.length; i += limit) {
            batches.push(promiseFunctions.slice(i, i + limit));
        }
        for (const batch of batches) {
            await Promise.all(batch);
        }
    }
    async checkDevice(name, deviceInfo, isPriority = false) {
        if (this.server.pingTasks.has(name)) {
            if (!isPriority) {
                return;
            }
        }
        const checkPromise = this._checkDeviceInternal(name, deviceInfo);
        this.server.pingTasks.set(name, checkPromise);
        try {
            await checkPromise;
        } catch (error) {
            logger.error(`Erro ao verificar dispositivo ${name}: ${error.message}`);
        } finally {
            this.server.pingTasks.delete(name);
        }
    }
    async _checkDeviceInternal(name, deviceInfo) {
        const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const result = {
            name: name,
            ip: deviceInfo.ip,
            category: deviceInfo.category || 'Outros',
            description: deviceInfo.description || '',
            icon: deviceInfo.icon || 'device',
            timestamp: timestamp
        };
        const currentHour = new Date().getHours();
        const isWeekday = [1, 2, 3, 4, 5].includes(new Date().getDay() === 0 ? 7 : new Date().getDay());
        let isWorkingHours = true;
        if (deviceInfo.workingHours) {
            const workingHours = deviceInfo.workingHours;
            isWorkingHours = false;
            if (workingHours.weekday && isWeekday) {
                const start = workingHours.weekday.start || 7;
                const end = workingHours.weekday.end || 18;
                isWorkingHours = (currentHour >= start && currentHour < end);
            }
            if (!isWorkingHours && workingHours.weekend && !isWeekday) {
                const start = workingHours.weekend.start || 9;
                const end = workingHours.weekend.end || 16;
                isWorkingHours = (currentHour >= start && currentHour < end);
            }
        }
        if (!isWorkingHours && !(deviceInfo['24h'])) {
            result.status = 'Fora de horário';
            result.responseTime = null;
            this.server.deviceStateManager.updateDeviceState(name, result);
            return;
        }
        try {
            const pingResult = await this.pingWithRetry(deviceInfo.ip, this.server.retryCount);
            result.status = pingResult.success ? 'Online' : 'Offline';
            result.responseTime = pingResult.responseTime;
        } catch (error) {
            logger.error(`Erro durante ping para ${name}: ${error.message}`);
            result.status = 'Offline';
            result.responseTime = null;
        }
        this.server.deviceStateManager.updateDeviceState(name, result);
    }
    async pingWithRetry(ip, retryCount = 2) {
        let successCount = 0;
        let lastResponseTime = null;
        for (let attempt = 0; attempt < retryCount; attempt++) {
            try {
                const result = await this.executePing(ip);
                if (result.success) {
                    successCount++;
                    lastResponseTime = result.responseTime;
                }
            } catch (error) {
                logger.error(`Erro no ping para ${ip} (tentativa ${attempt + 1}): ${error.message}`);
            }
        }
        return {
            success: successCount > (retryCount / 2),
            responseTime: lastResponseTime
        };
    }
    async executePing(ip) {
        const escapedIP = ip.replace(/"/g, '\\"');
        const count = 1;
        const timeout = 2000;
        let command, pattern;
        if (os.platform() === 'win32') {
            command = `ping -n ${count} -w ${timeout} ${escapedIP}`;
            pattern = /(?:Average|Média) = ([0-9.]+)ms/i;
        } else {
            const timeoutSecs = timeout / 1000;
            command = `ping -c ${count} -W ${timeoutSecs} ${escapedIP}`;
            pattern = /(?:min\/avg\/max\/(?:stddev|mdev)|rtt min\/avg\/max\/mdev) = ([0-9.]+)\/([0-9.]+)\/([0-9.]+)\/([0-9.]+)/;
        }
        try {
            const { stdout } = await execPromise(command);
            let responseTime = null;
            if (os.platform() === 'win32') {
                const matches = stdout.match(pattern);
                if (matches && matches[1]) {
                    responseTime = parseFloat(matches[1]);
                } else {
                    const timePattern = /tempo=([0-9.]+)ms/i;
                    const altMatches = stdout.match(timePattern);
                    if (altMatches && altMatches[1]) {
                        responseTime = parseFloat(altMatches[1]);
                    } else {
                        responseTime = 1;
                    }
                }
            } else {
                const matches = stdout.match(pattern);
                if (matches && matches[2]) {
                    responseTime = parseFloat(matches[2]);
                } else {
                    const timePattern = /time=([0-9.]+) ms/i;
                    const altMatches = stdout.match(timePattern);
                    if (altMatches && altMatches[1]) {
                        responseTime = parseFloat(altMatches[1]);
                    } else {
                        responseTime = 1;
                    }
                }
            }
            return {
                success: true,
                responseTime: responseTime
            };
        } catch (error) {
            return {
                success: false,
                responseTime: null
            };
        }
    }
}
module.exports = { PingService };
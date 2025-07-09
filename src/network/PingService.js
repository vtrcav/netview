/**
 * NetView v3.2.0
 *
 * 2023–2025 — Vitor Cavalcante (vtrcav)
 * Repositório: https://github.com/vtrcav/netview
 * 
 * PingService.js: módulo responsável por verificar os dispositivos usando ICMP (ping).
 *
 * Parâmetros principais:
 *
 * ┌────────────────────┬─────────────┬────────────────────────────────────────────────────────┐
 * │ Nome               │ Unidade     │ Descrição                                              │
 * ├────────────────────┼─────────────┼────────────────────────────────────────────────────────┤
 * │ packets            │ número      │ Quantidade de pacotes enviados por tentativa           │
 * │ timeout            │ milisseg.   │ Tempo máximo de espera por resposta (por tentativa)    │
 * │ retries            │ número      │ Número de tentativas extras após falha                 │
 * │ backoffFactor      │ número      │ Fator de multiplicação do timeout a cada nova tentativa│
 * │ size               │ bytes       │ Tamanho do pacote (auto-ajustado por arquitetura)      │
 * └────────────────────┴─────────────┴────────────────────────────────────────────────────────┘
 *
 * Valores padrão:
 * - packets: 3
 * - timeout: 1000ms
 * - retries: 3
 * - backoffFactor: 1.5
 * - size: 68 bytes (x64) / 56 bytes (x86)
 *
 */
const os = require('os');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);
const logger = require('../utils/Logger');
class PingService {
    constructor(server) {
        this.server = server;
        this.config = {
            packets: 3,
            timeout: 1000,
            retries: 3,
            backoffFactor: 1.5,
            size: os.arch() === 'x64' ? 68 : 56
        };
        logger.info(`PingService iniciado - Platform: ${os.platform()}, Arch: ${os.arch()}`);
        logger.info('Configuração de Ping:', this.config);
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
        if (this.server.pingTasks.has(name) && !isPriority) {
            return;
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
        if (!isWorkingHours && !deviceInfo['24h']) {
            result.status = 'Fora de horário';
            result.responseTime = null;
            this.server.deviceStateManager.updateDeviceState(name, result);
            return;
        }
        try {
            const pingResult = await this.pingWithAdvancedRetry(deviceInfo.ip);
            result.status = pingResult.success ? 'Online' : 'Offline';
            result.responseTime = pingResult.avgResponseTime;
            result.packetLoss = pingResult.packetLoss;
        } catch (error) {
            logger.error(`Erro crítico durante ping para ${name}: ${error.message}`);
            result.status = 'Offline';
            result.responseTime = null;
            result.packetLoss = 100;
        }
        this.server.deviceStateManager.updateDeviceState(name, result);
    }
    async pingWithAdvancedRetry(ip) {
        let currentTimeout = this.config.timeout;
        for (let attempt = 0; attempt <= this.config.retries; attempt++) {
            try {
                const result = await this.executePingWithStats(ip, currentTimeout);
                if (result.success) {
                    logger.info(`✅ Ping para ${ip} bem-sucedido na tentativa ${attempt + 1}.`);
                    return result;
                }
                logger.warn(`⚠️ Tentativa ${attempt + 1} para ${ip} falhou. ${result.received}/${result.sent} pacotes.`);
            } catch (error) {
                logger.error(`❌ Erro na tentativa ${attempt + 1} para ${ip}: ${error.message}`);
            }
            currentTimeout = Math.round(currentTimeout * this.config.backoffFactor);
        }
        logger.error(`🚨 Todas as ${this.config.retries + 1} tentativas para ${ip} falharam.`);
        return { success: false, avgResponseTime: null, packetLoss: 100, sent: this.config.packets, received: 0 };
    }
    async executePingWithStats(ip, timeout) {
        const { packets, size } = this.config;
        const escapedIP = ip.replace(/"/g, '\\"');
        let command;
        if (os.platform() === 'win32') {
            command = `ping -n ${packets} -w ${timeout} -l ${size} ${escapedIP}`;
        } else {
            const timeoutSecs = Math.max(1, Math.round(timeout / 1000));
            command = `ping -c ${packets} -W ${timeoutSecs} -s ${size} ${escapedIP}`;
        }
        try {
            const { stdout } = await execPromise(command, { timeout: timeout + 2000 });
            return this.parsePingResult(stdout);
        } catch (error) {
            const outputOnError = error.stdout || error.stderr || '';
            logger.warn(`Comando ping para ${ip} falhou. Analisando saída de erro.`);
            return this.parsePingResult(outputOnError);
        }
    }
    parsePingResult(stdout) {
        let sent = 0;
        let received = 0;
        let avgResponseTime = null;
        let responseTimes = []; 
        sent = this.config.packets;
        if (os.platform() === 'win32') {
            const packetsMatch = stdout.match(/(?:Packets|Pacotes): (?:Sent|Enviados) = (\d+), (?:Received|Recebidos) = (\d+), (?:Lost|Perdidos) = (\d+)/);
            if (packetsMatch) {
                sent = parseInt(packetsMatch[1], 10);
                received = parseInt(packetsMatch[2], 10);
            }
            const avgMatch = stdout.match(/(?:Average|Média) = (\d+)ms/);
            if (avgMatch) {
                avgResponseTime = parseInt(avgMatch[1], 10);
            } else if (received > 0) {
                const replyMatches = stdout.matchAll(/(?:Resposta de|Reply from) .* tempo(?:<|=)(\d+)ms/gi);
                for (const match of replyMatches) {
                    responseTimes.push(parseInt(match[1], 10));
                }

                if (responseTimes.length > 0) {
                    const sum = responseTimes.reduce((a, b) => a + b, 0);
                    avgResponseTime = sum / responseTimes.length;
                }
            }

        } else {
            const packetsMatch = stdout.match(/(\d+) (?:packets transmitted|pacotes transmitidos), (\d+) (?:received|recebidos)/);
            if (packetsMatch) {
                sent = parseInt(packetsMatch[1], 10);
                received = parseInt(packetsMatch[2], 10);
            }
            const rttMatch = stdout.match(/rtt min\/(?:avg|méd)\/max\/mdev = [\d.]+\/([\d.]+)\//);
            if (rttMatch) {
                avgResponseTime = parseFloat(rttMatch[1]);
            }
        }
        const packetLoss = (sent > 0) ? ((sent - received) / sent) * 100 : 100;
        const success = received > 0;
        return {
            success,
            avgResponseTime: avgResponseTime ? Math.round(avgResponseTime) : null,
            packetLoss: Math.round(packetLoss),
            sent,
            received
        };
    }
}
module.exports = { PingService };
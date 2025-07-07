const WebSocket = require('ws');
const logger = require('../utils/Logger');
class WebSocketHandler {
    constructor(server) {
        this.server = server;
    }
    handleConnection(ws, req) {
        this.server.clients.add(ws);
        logger.info(`Nova conexão! (${req.socket.remoteAddress})`);
        this.sendInitialStates(ws);
        ws.on('message', (message) => {
            this.handleMessage(ws, message);
        });
        ws.on('close', () => {
            this.server.clients.delete(ws);
            logger.info(`Conexão ${req.socket.remoteAddress} foi desconectada`);
        });
        ws.on('error', (error) => {
            logger.info(`Erro: ${error.message}`);
            this.server.clients.delete(ws);
        });
    }
    handleMessage(ws, message) {
        try {
            const data = JSON.parse(message);
            if (data.type) {
                switch (data.type) {
                    case 'manual_check':
                        logger.info(`Verificação manual solicitada pelo cliente`);
                        this.server.pingService.checkAllDevices();
                        break;
                    case 'check_device':
                        if (data.device && this.server.deviceConfig[data.device]) {
                            const deviceName = data.device;
                            const deviceInfo = this.server.deviceConfig[deviceName];
                            logger.info(`Verificação individual do dispositivo '${deviceName}' solicitada pelo cliente`);
                            this.server.pingService.checkDevice(deviceName, deviceInfo, true);
                        }
                        break;
                    case 'get_config':
                        const configData = JSON.stringify({
                            type: 'config_data',
                            config: this.server.deviceConfig,
                            timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(',', ''),
                        });
                        ws.send(configData);
                        break;
                    case 'update_interval':
                        logger.info(`Ignorando solicitação de atualização de intervalo do cliente`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'O intervalo de verificação é definido pelo servidor'
                        }));
                        break;
                    default:
                        logger.info(`Mensagem de tipo desconhecido: ${data.type}`);
                        break;
                }
            }
        } catch (error) {
            logger.info(`Erro ao processar mensagem: ${error.message}`);
            ws.send(JSON.stringify({
                type: 'error',
                message: `Erro ao processar a solicitação: ${error.message}`
            }));
        }
    }
    sendInitialStates(ws) {
        const groupedResults = this.server.deviceStates;
        let results = this.server.deviceStateManager.getAllDevices();
        const stats = {
            total: results.length,
            online: results.filter(item => item.status === 'Online').length,
            offline: results.filter(item => item.status === 'Offline').length,
            outOfHours: results.filter(item => item.status === 'Fora de horário').length,
            checkDuration: 'Real-time'
        };
        const response = {
            type: 'status_update',
            timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
            groups: groupedResults,
            stats: stats
        };
        this.server.lastCheck = response;
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(response));
            logger.info(`Estado inicial enviado para cliente: ${JSON.stringify(stats)}`);
        }
    }
}
module.exports = { WebSocketHandler };
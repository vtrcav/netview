const WebSocket = require('ws');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const http = require('http');
const os = require('os');
const util = require('util');
const execPromise = util.promisify(exec);

// WhatsApp Web Integration
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

class NetViewServer {
    constructor() {
        this.clients = new Set();
        this.deviceStates = {};
        this.pingInterval = 5; // Intervalo de verificação em segundos
        this.configWatchInterval = 10;
        this.deviceConfig = {};
        this.lastCheck = null;
        this.configLastModified = 0;
        this.configFile = path.join(__dirname, '/config/devices.json');
        this.timers = {};
        this.pingTasks = new Map(); // Rastreia as tarefas de ping em andamento
        this.retryCount = 4; // Número de tentativas de ping para confirmar status
        this.concurrentPings = 10; // Número máximo de pings simultâneos
        this.offlineNotifications = {};  // Rastrear últimas notificações
        this.deviceOfflineHistory = {};  // Rastrear histórico de offline
        this.NOTIFICATION_COOLDOWN = 30 * 60 * 1000;  // 30 minutos
        this.MAX_CONSECUTIVE_OFFLINE_ALERTS = 3;
        this.serverStartTime = Date.now();
        this.INITIAL_SCAN_DELAY = 60 * 1000;  // 1 minuto de delay após inicialização
        this.OFFLINE_THRESHOLD = 15 * 1000;   // 15 segundos para considerar dispositivo offline

        // ID do grupo para enviar as notificações
        this.notificationGroupId = 'COLOQUE_O_ID_AQUI';

        // Configurações de log
        console.log(`Caminho do arquivo de configuração: ${this.configFile}`);

        // WhatsApp Web Client Initialization
        this.whatsappClient = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        // Configuração dos eventos do WhatsApp
        this.setupWhatsAppClient();

        // Carregamento de configurações e verificações iniciais
        this.loadDeviceConfig();
        this.checkAllDevices();
        this.setupTimers();

        console.log("Servidor NetView inicializado");
    }

    setupWhatsAppClient() {
        this.whatsappClient.on('qr', (qr) => {
            console.log('Código QR do WhatsApp recebido. Escaneie com o WhatsApp Mobile:');
            qrcode.generate(qr, {small: true});
        });

        this.whatsappClient.on('ready', () => {
            console.log('Cliente WhatsApp está pronto!');
            this.sendInitialStartupMessage();
        });

        this.whatsappClient.on('authenticated', () => {
            console.log('Cliente WhatsApp autenticado com sucesso');
        });

        this.whatsappClient.on('auth_failure', (msg) => {
            console.error('Falha na autenticação do WhatsApp:', msg);
            // Tente reinicializar
            this.whatsappClient.initialize().catch(error => {
                console.error('Erro na reinicialização:', error);
            });
        });

        this.whatsappClient.on('disconnected', (reason) => {
            console.log('Cliente WhatsApp desconectado:', reason);
            // Tente reconectar
            this.setupWhatsAppClient();
        });

        // Adicione tratamento de erro global
        this.whatsappClient.initialize().catch(error => {
            console.error('Erro crítico na inicialização do WhatsApp:', error);
            console.error('Detalhes completos do erro:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        });
    }

    async sendInitialStartupMessage() {
        try {
            const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

            const message = `🖥️ *NetView* 🖥️\n\n` +
                            `Iniciado e monitoramento ativo.\n` +
                            `Notificarei aqui quando detectar dispositivos offline =D`;

            await this.whatsappClient.sendMessage(this.notificationGroupId, message);
        } catch (error) {
            console.error('Erro ao enviar mensagem de inicialização:', error);
        }
    }

    async sendOfflineNotification(device) {
    const now = Date.now();
    const deviceKey = device.name || device.ip;

    // Verifica se o servidor está em período inicial de varredura
    if (now - this.serverStartTime < this.INITIAL_SCAN_DELAY) {
        console.log(`Dispositivo ${deviceKey} - Ignorando notificação durante período inicial`);
        return;
    }

    // Inicializa o registro do dispositivo se não existir
    if (!this.offlineNotifications[deviceKey]) {
        this.offlineNotifications[deviceKey] = {
            notificationSent: false,
            firstOfflineTime: now,
            lastOfflineCheck: now
        };
    }

    // Inicializa histórico de offline
    if (!this.deviceOfflineHistory[deviceKey]) {
        this.deviceOfflineHistory[deviceKey] = {
            firstOfflineTime: now,
            wasOnlineBefore: true,
            isCurrentlyOffline: true
        };
    }

    const deviceNotification = this.offlineNotifications[deviceKey];
    const offlineHistory = this.deviceOfflineHistory[deviceKey];

    // Atualiza o timestamp da última verificação offline
    deviceNotification.lastOfflineCheck = now;
    
    // Se o dispositivo não estava offline antes, marca como primeira vez offline
    if (offlineHistory.wasOnlineBefore) {
        offlineHistory.firstOfflineTime = now;
        offlineHistory.wasOnlineBefore = false;
        offlineHistory.isCurrentlyOffline = true;
        console.log(`Dispositivo ${deviceKey} - Primeira detecção de offline`);
    }

    // Verifica se atingiu o threshold de tempo offline
    const timeOffline = now - offlineHistory.firstOfflineTime;
    if (timeOffline < this.OFFLINE_THRESHOLD) {
        console.log(`Dispositivo ${deviceKey} - Ainda não atingiu threshold (${timeOffline}ms < ${this.OFFLINE_THRESHOLD}ms)`);
        return;
    }

    // Envia notificação apenas se ainda não foi enviada E o dispositivo realmente está offline há tempo suficiente
    if (!deviceNotification.notificationSent && offlineHistory.isCurrentlyOffline) {
        try {
            const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const message = `⚠️ *DISPOSITIVO OFFLINE* ⚠️\n\n` +
                          `*Nome:* ${device.name}\n` +
                          `*IP:* ${device.ip}\n` +
                          `*Descrição:* ${device.description || 'Sem descrição'}\n` +
                          `*Timestamp:* ${timestamp}\n`;

            await this.whatsappClient.sendMessage(this.notificationGroupId, message);

            // Marca que a notificação foi enviada
            deviceNotification.notificationSent = true;
            deviceNotification.notificationSentTime = now;

            console.log(`✅ Notificação de offline enviada para dispositivo: ${deviceKey}`);
        } catch (error) {
            console.error(`❌ Erro ao enviar notificação de offline para ${deviceKey}:`, error);
        }
    } else if (deviceNotification.notificationSent) {
        console.log(`Dispositivo ${deviceKey} - Notificação já enviada, ignorando`);
    }
}

    async sendOnlineNotification(device) {
    const deviceKey = device.name || device.ip;
    const offlineHistory = this.deviceOfflineHistory[deviceKey];
    const deviceNotification = this.offlineNotifications[deviceKey];

    console.log(`Dispositivo ${deviceKey} - Verificando necessidade de notificação de online`);

    // Só processa se o dispositivo estava realmente offline antes
    if (offlineHistory && !offlineHistory.wasOnlineBefore && offlineHistory.isCurrentlyOffline) {
        // Só envia notificação de online se uma notificação de offline foi enviada
        if (deviceNotification && deviceNotification.notificationSent) {
            try {
                const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                const offlineDuration = this.formatDuration(Date.now() - offlineHistory.firstOfflineTime);

                const message = `✅ *DISPOSITIVO ONLINE* ✅\n\n` +
                              `*Nome:* ${device.name}\n` +
                              `*IP:* ${device.ip}\n` +
                              `*Descrição:* ${device.description || 'Sem descrição'}\n` +
                              `*Timestamp:* ${timestamp}\n` +
                              `*Tempo offline:* ${offlineDuration}`;

                await this.whatsappClient.sendMessage(this.notificationGroupId, message);

                console.log(`✅ Notificação de online enviada para dispositivo: ${deviceKey}`);
            } catch (error) {
                console.error(`❌ Erro ao enviar notificação de online para ${deviceKey}:`, error);
            }
        }

        // Reseta completamente o estado para permitir nova detecção
        this.resetDeviceNotificationState(deviceKey);
    } else {
        console.log(`Dispositivo ${deviceKey} - Não precisa de notificação de online`);
    }
}

    // Método opcional para resetar contadores de notificações
    resetDeviceNotificationState(deviceKey) {
    console.log(`Resetando estado de notificação para dispositivo: ${deviceKey}`);
    
    if (this.offlineNotifications[deviceKey]) {
        delete this.offlineNotifications[deviceKey];
    }

    if (this.deviceOfflineHistory[deviceKey]) {
        delete this.deviceOfflineHistory[deviceKey];
    }
}

    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} dia(s)`;
        if (hours > 0) return `${hours} hora(s)`;
        if (minutes > 0) return `${minutes} minuto(s)`;
        return `${seconds} segundo(s)`;
    }

    loadDeviceConfig() {
        if (fs.existsSync(this.configFile)) {
            try {
                const jsonContent = fs.readFileSync(this.configFile, 'utf8');
                this.deviceConfig = JSON.parse(jsonContent);
                console.log(`Configuração de dispositivos carregada com sucesso. Total de dispositivos: ${Object.keys(this.deviceConfig).length}`);
            } catch (error) {
                console.log(`Erro ao analisar o arquivo de configuração: ${error.message}`);
                this.deviceConfig = {};
            }
        } else {
            console.log(`Arquivo de configuração não encontrado: ${this.configFile}`);
            this.deviceConfig = {};
        }
    }

    checkConfigUpdates() {
        if (fs.existsSync(this.configFile)) {
            const currentMTime = fs.statSync(this.configFile).mtimeMs;

            if (currentMTime > this.configLastModified) {
                console.log("Detectada alteração no arquivo de configuração. Recarregando...");
                this.configLastModified = currentMTime;
                this.loadDeviceConfig();

                const notification = JSON.stringify({
                    type: 'config_updated',
                    timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' }).replace(',', ''),
                    message: 'Configuração de dispositivos atualizada'
                });

                for (const client of this.clients) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(notification);
                    }
                }
            }
        }
    }

    setupTimers() {
        console.log("Configurando timers...");

        // Limpar timers existentes
        for (const key in this.timers) {
            clearInterval(this.timers[key]);
        }
        this.timers = {};

        // Timer para verificar atualizações no arquivo de configuração
        this.timers['config'] = setInterval(() => {
            this.checkConfigUpdates();
        }, this.configWatchInterval * 1000);

        // Timer para verificar o status dos dispositivos
        this.timers['devices'] = setInterval(() => {
            //console.log("Iniciando verificação periódica dos dispositivos...");
            this.checkAllDevices();
        }, this.pingInterval * 1000);

        console.log(`Timers configurados - Ping: ${this.pingInterval}s, Config Watch: ${this.configWatchInterval}s`);
    }

    handleConnection(ws, req) {
        this.clients.add(ws);
        console.log(`Nova conexão! (${req.socket.remoteAddress})`);

        this.sendInitialStates(ws);

        ws.on('message', (message) => {
            this.handleMessage(ws, message);
        });

        ws.on('close', () => {
            this.clients.delete(ws);
            console.log(`Conexão ${req.socket.remoteAddress} foi desconectada`);
        });

        ws.on('error', (error) => {
            console.log(`Erro: ${error.message}`);
            this.clients.delete(ws);
        });
    }

    handleMessage(ws, message) {
        try {
            const data = JSON.parse(message);

            if (data.type) {
                switch (data.type) {
                    case 'manual_check':
                        console.log(`Verificação manual solicitada pelo cliente`);
                        this.checkAllDevices();
                        break;
                    case 'check_device':
                        if (data.device && this.deviceConfig[data.device]) {
                            const deviceName = data.device;
                            const deviceInfo = this.deviceConfig[deviceName];
                            console.log(`Verificação individual do dispositivo '${deviceName}' solicitada pelo cliente`);
                            // Prioriza a verificação individual
                            this.checkDevice(deviceName, deviceInfo, true);
                        }
                        break;
                    case 'get_config':
                        const configData = JSON.stringify({
                            type: 'config_data',
                            config: this.deviceConfig,
                            timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' }).replace(',', ''),
                        });
                        ws.send(configData);
                        break;
                    case 'update_interval':
                        console.log(`Ignorando solicitação de atualização de intervalo do cliente`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'O intervalo de verificação é definido pelo servidor'
                        }));
                        break;
                    default:
                        console.log(`Mensagem de tipo desconhecido: ${data.type}`);
                        break;
                }
            }
        } catch (error) {
            console.log(`Erro ao processar mensagem: ${error.message}`);
            ws.send(JSON.stringify({
                type: 'error',
                message: `Erro ao processar a solicitação: ${error.message}`
            }));
        }
    }

    async checkAllDevices() {
        //console.log("Iniciando verificação de todos os dispositivos de forma assíncrona...");

        // Cria um array de promessas para verificação de todos os dispositivos
        const checkPromises = Object.entries(this.deviceConfig).map(
            ([name, info]) => this.checkDevice(name, info, false)
        );

        // Executa todas as verificações em paralelo, limitando concorrência
        await this.runWithConcurrencyLimit(checkPromises, this.concurrentPings);

        console.log("Verificação de todos os dispositivos concluída");
    }

    // Executa promessas com limite de concorrência
    async runWithConcurrencyLimit(promiseFunctions, limit) {
        // Separa em lotes para não exceder o limite de concorrência
        const batches = [];
        for (let i = 0; i < promiseFunctions.length; i += limit) {
            batches.push(promiseFunctions.slice(i, i + limit));
        }

        // Executa os lotes sequencialmente, mas com promessas concorrentes dentro de cada lote
        for (const batch of batches) {
            await Promise.all(batch);
        }
    }

    async checkDevice(name, deviceInfo, isPriority = false) {
        // Se já houver uma verificação em andamento para este dispositivo, cancela a menos que seja prioritária
        if (this.pingTasks.has(name)) {
            if (!isPriority) {
                return; // Ignora verificações não prioritárias duplicadas
            }
        }

        // Define uma Promise que será resolvida quando a verificação for concluída
        const checkPromise = this._checkDeviceInternal(name, deviceInfo);

        // Registra a tarefa
        this.pingTasks.set(name, checkPromise);

        try {
            await checkPromise;
        } catch (error) {
            console.error(`Erro ao verificar dispositivo ${name}: ${error.message}`);
        } finally {
            // Remove a tarefa quando concluída
            this.pingTasks.delete(name);
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
        const isWeekday = [1, 2, 3, 4, 5].includes(new Date().getDay() === 0 ? 7 : new Date().getDay()); // Ajustando domingo
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
            this.updateDeviceState(name, result);
            return;
        }

        try {
            const pingResult = await this.pingWithRetry(deviceInfo.ip, this.retryCount);
            result.status = pingResult.success ? 'Online' : 'Offline';
            result.responseTime = pingResult.responseTime;
        } catch (error) {
            console.error(`Erro durante ping para ${name}: ${error.message}`);
            result.status = 'Offline';
            result.responseTime = null;
        }

        this.updateDeviceState(name, result);
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
                console.error(`Erro no ping para ${ip} (tentativa ${attempt + 1}): ${error.message}`);
            }
        }

        // Se pelo menos dois pings foram bem-sucedidos, consideramos o dispositivo online
        return {
            success: successCount > (retryCount / 2), // Exigir maioria (>50%) em vez de apenas um
            responseTime: lastResponseTime
        };
    }

    async executePing(ip) {
        const escapedIP = ip.replace(/"/g, '\\"');
        const count = 1; // Apenas 1 pacote por tentativa
        const timeout = 2000; // Timeout de 2s

        let command, pattern;

        if (os.platform() === 'win32') {
            command = `ping -n ${count} -w ${timeout} ${escapedIP}`;
            // Padrão mais flexível para Windows
            pattern = /(?:Average|Média) = ([0-9.]+)ms/i;
        } else {
            const timeoutSecs = timeout / 1000;
            command = `ping -c ${count} -W ${timeoutSecs} ${escapedIP}`;
            // Padrão mais flexível para Linux/macOS
            pattern = /(?:min\/avg\/max\/(?:stddev|mdev)|rtt min\/avg\/max\/mdev) = ([0-9.]+)\/([0-9.]+)\/([0-9.]+)\/([0-9.]+)/;
        }

        try {
            const { stdout } = await execPromise(command);
            //console.log(`Saída ping para ${ip}:`, stdout);

            let responseTime = null;

            if (os.platform() === 'win32') {
                const matches = stdout.match(pattern);
                if (matches && matches[1]) {
                    responseTime = parseFloat(matches[1]);
                    //console.log(`Tempo de resposta extraído (Windows): ${responseTime}ms`);
                } else {
                    // Tentar extrair tempo de um pacote individual se a média não estiver disponível
                    const timePattern = /tempo=([0-9.]+)ms/i;
                    const altMatches = stdout.match(timePattern);
                    if (altMatches && altMatches[1]) {
                        responseTime = parseFloat(altMatches[1]);
                        //console.log(`Tempo alternativo extraído (Windows): ${responseTime}ms`);
                    } else {
                        //console.log(`Não foi possível extrair tempo de resposta de: ${stdout}`);
                        responseTime = 1; // Valor mínimo padrão para indicar que respondeu
                    }
                }
            } else {
                // Para Linux/macOS
                const matches = stdout.match(pattern);
                if (matches && matches[2]) { // matches[2] contém o tempo médio
                    responseTime = parseFloat(matches[2]);
                    //console.log(`Tempo de resposta extraído (Unix): ${responseTime}ms`);
                } else {
                    // Tentar extrair de um padrão alternativo
                    const timePattern = /time=([0-9.]+) ms/i;
                    const altMatches = stdout.match(timePattern);
                    if (altMatches && altMatches[1]) {
                        responseTime = parseFloat(altMatches[1]);
                        //console.log(`Tempo alternativo extraído (Unix): ${responseTime}ms`);
                    } else {
                        //console.log(`Não foi possível extrair tempo de resposta de: ${stdout}`);
                        responseTime = 1; // Valor mínimo padrão para indicar que respondeu
                    }
                }
            }

            return {
                success: true,
                responseTime: responseTime
            };
        } catch (error) {
            //console.error(`Erro executando ping para ${ip}:`, error.message);
            return {
                success: false,
                responseTime: null
            };
        }
    }

    updateDeviceState(name, result) {
    result.timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const category = result.category || 'Outros';
    if (!this.deviceStates[category]) {
        this.deviceStates[category] = [];
    }

    const previousState = this.getDevicePreviousState(name, category);
    let updated = false;
    let statusChanged = false;

    // Atualiza ou adiciona o dispositivo no estado
    this.deviceStates[category] = this.deviceStates[category].map(device => {
        if (device.name === name) {
            updated = true;
            statusChanged = device.status !== result.status;
            return result;
        }
        return device;
    });

    if (!updated) {
        this.deviceStates[category].push(result);
        statusChanged = true;
    }

    console.log(`Status do dispositivo ${name}: ${result.status} (mudou: ${statusChanged})`);

    // Processa notificações baseado no status atual
    if (result.status === 'Offline') {
        this.sendOfflineNotification(result);
    } else if (result.status === 'Online') {
        this.sendOnlineNotification(result);
    }

    // Envia atualizações para clientes WebSocket apenas quando há mudança
    if (statusChanged) {
        const update = JSON.stringify({
            type: 'device_update',
            device: result,
            timestamp: result.timestamp
        });

        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(update);
            }
        }

        if (previousState) {
            const stateChange = JSON.stringify({
                type: 'state_change',
                device: result,
                previous: previousState.status,
                current: result.status,
                timestamp: result.timestamp
            });

            for (const client of this.clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(stateChange);
                }
            }
        }

        this.sendStatsToAll();
    }
}

    sendStatsToAll() {
        for (const client of this.clients) {
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

        for (const category in this.deviceStates) {
            results = results.concat(this.deviceStates[category]);
        }

        return results;
    }

    sendInitialStates(ws) {
        const groupedResults = this.deviceStates;
        let results = this.getAllDevices();

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

        this.lastCheck = response;

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(response));
            console.log(`Estado inicial enviado para cliente: ${JSON.stringify(stats)}`);
        }
    }

    getDevicePreviousState(deviceName, category) {
        if (this.deviceStates[category]) {
            return this.deviceStates[category].find(device => device.name === deviceName) || null;
        }
        return null;
    }
}

// Configuração e inicialização do servidor
const port = process.argv[2] ? parseInt(process.argv[2]) : 8080;
const host = process.argv[3] || '0.0.0.0';

const netViewServer = new NetViewServer();
const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    netViewServer.handleConnection(ws, req);
});

server.listen(port, host, () => {
    console.log(`Servidor NetView iniciado em ${host}:${port}`);
});
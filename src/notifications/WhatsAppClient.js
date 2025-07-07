const { Client, LocalAuth } = require('whatsapp-web.js');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/Logger');
class WhatsAppClient {
    constructor(server) {
        this.server = server;
        this.whatsappClient = null;
        this.ready = false;
        this.connecting = false;
        this.isClearingSession = false;
        this.events = new EventEmitter();
    }
    async initializeWhatsApp() {
        if (this.whatsappClient || this.connecting) {
            logger.warn('Tentativa de inicializar o WhatsApp, mas o cliente já existe ou está em processo.');
            return;
        }
        logger.info('Inicializando cliente WhatsApp...');
        this.updateConnectionState('connecting');
        const authPath = path.join(__dirname, '../../.wwebjs_auth');
        this.whatsappClient = new Client({
            authStrategy: new LocalAuth({ dataPath: authPath }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });
        this.setupWhatsAppClient();
        try {
            await this.whatsappClient.initialize();
        } catch (error) {
            logger.error(`Erro crítico na inicialização do WhatsApp: ${error.message}`);
            this.clearSession('Erro na inicialização');
            throw error;
        }
    }
    setupWhatsAppClient() {
        if (!this.whatsappClient) return;
        this.whatsappClient.on('qr', (qr) => {
            this.events.emit('qr', qr);
        });
        this.whatsappClient.on('ready', async () => {
            this.updateConnectionState('connected');
            this.loadGroupId();
            this.server.setReadyForNotifications(true);
            if (this.canSendNotifications()) {
                await this.sendInitialStartupMessage();
            }
        });
        this.whatsappClient.on('auth_failure', (msg) => {
            logger.error(`Falha na autenticação do WhatsApp: ${msg}`);
            this.clearSession('Falha na autenticação');
        });
        this.whatsappClient.on('error', (error) => {
            logger.error(`Erro no cliente WhatsApp: ${error.message}.`);
            this.clearSession('Erro na sessão');
        });
        this.whatsappClient.on('disconnected', (reason) => {
            logger.warn(`Cliente WhatsApp desconectado: ${reason}`);
            this.clearSession(`Desconectado: ${reason}`);
        });
    }
    updateConnectionState(newState, reason = null) {
        const currentState = this.getConnectionStatus();
        if (newState === currentState) return;
        this.ready = newState === 'connected';
        this.connecting = newState === 'connecting';
        this.events.emit('status_change', { 
            status: newState, 
            reason: reason 
        });
    }
    async clearSession(reason = 'Sessão encerrada') {
        if (this.isClearingSession) return;
        this.isClearingSession = true;
        logger.info(`Iniciando limpeza da sessão. Motivo: ${reason}`);
        try {
            if (this.whatsappClient) {
                await this.whatsappClient.destroy().catch(err => logger.error(`Erro ao destruir cliente na limpeza: ${err.message}`));
                this.whatsappClient = null;
            }
            const projectRoot = path.resolve(__dirname, '../../');
            const groupConfigPath = path.join(projectRoot, 'config', 'whatsapp_group.json');
            const dirsToDelete = [
                path.join(projectRoot, '.wwebjs_auth'),
                path.join(projectRoot, '.wwebjs_cache')
            ];
            for (const dirPath of dirsToDelete) {
                if (fs.existsSync(dirPath)) {
                    await fs.promises.rm(dirPath, { recursive: true, force: true });
                }
            }
            if (fs.existsSync(groupConfigPath)) {
                await fs.promises.rm(groupConfigPath, { force: true });
            }
            if (this.server) {
                this.server.notificationGroupId = null;
            }
            this.updateConnectionState('disconnected', reason);
            logger.info('Limpeza da sessão e configuração de grupo concluída.');
            return true;
        } catch (error) {
            logger.error(`Erro ao limpar a sessão do WhatsApp: ${error.message}`);
            return false;
        } finally {
            this.isClearingSession = false;
        }
    }
    async disconnectWhatsApp() {
        if (!this.whatsappClient) {
            logger.warn('Comando para desconectar, mas o WhatsApp já não está conectado.');
            return;
        }
        logger.info('Desconectando WhatsApp intencionalmente...');
        this.whatsappClient.removeAllListeners();
        try {
            await this.whatsappClient.destroy();
        } catch (error) {
            logger.error(`Erro ao desconectar WhatsApp: ${error.message}`);
        } finally {
            this.whatsappClient = null;
            this.updateConnectionState('disconnected', 'Desconexão manual');
        }
    }
    getConnectionStatus() {
        if (this.connecting) return 'connecting';
        if (this.ready) return 'connected';
        return 'disconnected';
    }
    async detectGroups(chats) {
        const groups = [];
        for (const chat of chats) {
            if (chat.isGroup) {
                groups.push({
                    id: chat.id,
                    name: chat.name || 'Grupo sem nome',
                    isGroup: true,
                    participantCount: chat.participants ? chat.participants.length : 0,
                });
            }
        }
        return groups;
    }
    async listGroups() {
        if (!this.ready) {
            throw new Error('Cliente WhatsApp não está conectado.');
        }
        try {
            logger.info('Buscando lista de grupos do WhatsApp...');
            const chats = await this.whatsappClient.getChats();
            const groups = await this.detectGroups(chats);
            logger.info(`Encontrados ${groups.length} grupos.`);
            return groups.map(g => ({ ...g, id_serialized: g.id._serialized }));
        } catch (error) {
            logger.error(`Erro ao buscar grupos: ${error.stack}`);
            throw new Error(`Erro ao buscar grupos: ${error.message}`);
        }
    }
    async setGroup(groupId) {
        if (!this.ready) {
            throw new Error('Cliente WhatsApp não está conectado.');
        }
        try {
            const group = await this.whatsappClient.getChatById(groupId);
            if (!group || !group.isGroup) {
                throw new Error('O ID fornecido não corresponde a um grupo válido.');
            }
            this.server.notificationGroupId = groupId;
            this.saveGroupId();
            logger.info(`Grupo de notificação configurado para: ${group.name} (${groupId})`);
            const testMessage = `🔔 *NetView - Grupo Configurado*\n\nEste grupo foi configurado para receber notificações do sistema.\nConfigurado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
            await this.sendMessage(testMessage);
            return group.name;
        } catch (error) {
            logger.error(`Erro ao definir grupo: ${error.message}`);
            throw error;
        }
    }
    async sendMessage(message) {
        if (!this.canSendNotifications()) {
            logger.error('Tentativa de enviar mensagem, mas o cliente não está pronto ou nenhum grupo foi configurado.');
            return false;
        }
        try {
            await this.whatsappClient.sendMessage(this.server.notificationGroupId, message);
            logger.info(`Mensagem enviada para o grupo: ${message.substring(0, 50)}...`);
            return true;
        } catch (error) {
            logger.error(`Falha ao enviar mensagem para o grupo ${this.server.notificationGroupId}: ${error.message}`);
            return false;
        }
    }
    async sendInitialStartupMessage() {
        if (!this.server.notificationGroupId) {
            logger.info('Nenhum grupo configurado para mensagem inicial.');
            return;
        }
        try {
            const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const message = `🖥️ *NetView* 🖥️\n\nConectado e monitoramento ativo.\nNotificarei aqui quando detectar dispositivos offline.\n\nData/Hora: ${timestamp}`;
            const success = await this.sendMessage(message);
            if (success) {
                logger.info('Mensagem inicial de startup enviada com sucesso!');
            } else {
                logger.warn('Não foi possível enviar a mensagem inicial de startup.');
            }
        } catch (error) {
            logger.error(`Erro ao enviar mensagem de inicialização: ${error.message}`);
        }
    }
    saveGroupId() {
        try {
            const configDir = path.join(__dirname, '../../config');
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            const configPath = path.join(configDir, 'whatsapp_group.json');
            fs.writeFileSync(configPath, JSON.stringify({ groupId: this.server.notificationGroupId }, null, 2));
            logger.info('ID do grupo salvo em config/whatsapp_group.json');
        } catch (error) {
            logger.error(`Erro ao salvar ID do grupo: ${error.message}`);
        }
    }
    loadGroupId() {
        try {
            const configPath = path.join(__dirname, '../../config/whatsapp_group.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath));
                if (config.groupId && typeof config.groupId === 'string') {
                    this.server.notificationGroupId = config.groupId;
                    logger.info(`ID de grupo carregado do arquivo: ${this.server.notificationGroupId}`);
                }
            }
        } catch (error) {
            logger.error(`Erro ao carregar ID do grupo salvo: ${error.message}`);
        }
    }
    canSendNotifications() {
        return this.ready && !!this.server.notificationGroupId;
    }
    async debugWhatsApp() {
        logger.info("--- INÍCIO DIAGNÓSTICO WHATSAPP ---");
        logger.info(`Cliente Instanciado: ${!!this.whatsappClient}`);
        logger.info(`Status "ready": ${this.ready}`);
        logger.info(`Status "connecting": ${this.connecting}`);
        logger.info(`Status Geral: ${this.getConnectionStatus()}`);
        logger.info(`Grupo Configurado: ${this.server.notificationGroupId || 'Nenhum'}`);
        if (this.whatsappClient && this.ready) {
            try {
                const state = await this.whatsappClient.getState();
                logger.info(`Estado do Cliente (getState): ${state}`);
                const chats = await this.whatsappClient.getChats();
                logger.info(`Total de chats encontrados: ${chats.length}`);
                const groups = chats.filter(c => c.isGroup);
                logger.info(`Total de grupos detectados: ${groups.length}`);
            } catch (error) {
                logger.error(`Erro durante o diagnóstico do cliente: ${error.message}`);
            }
        }
        logger.info("--- FIM DIAGNÓSTICO WHATSAPP ---");
    }
}
module.exports = { WhatsAppClient };
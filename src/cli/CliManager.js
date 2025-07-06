const readline = require('readline');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/Logger');
class CliManager {
    constructor(server) {
        this.server = server;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.bold.green('NetView > ')
        });
        this.consoleLogsEnabled = false;
        this.registerEventListeners();
    }
    printAsyncMessage(message) {
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
        console.log(message);
        this.rl.prompt(true);
    }
    registerEventListeners() {
        logger.on('log', (logString) => {
            if (this.consoleLogsEnabled) {
                let coloredString = logString;
                if (logString.includes('[ERROR]')) coloredString = chalk.redBright(logString);
                else if (logString.includes('[WARN]')) coloredString = chalk.yellowBright(logString);
                else if (logString.includes('[INFO]')) coloredString = chalk.blueBright(logString);
                this.printAsyncMessage(coloredString);
            }
        });
        const waEvents = this.server.whatsappClient.events;
        waEvents.on('qr', (qr) => {
            this.printAsyncMessage(chalk.yellow('\n📱 Escaneie o QR Code abaixo com seu WhatsApp:'));
            qrcode.generate(qr, { small: true }, (qrCodeString) => {
                console.log(qrCodeString);
                this.rl.prompt(true);
            });
        });
        waEvents.on('status_change', () => {
            this.showWhatsAppStatus(true);
        });
    }
    async start() {
        console.log(chalk.bold.yellow('🚀 Bem-vindo ao CLI do NetView'));
        this.showHelp();
        this.rl.prompt();
        this.rl.on('line', async (line) => {
            const command = line.trim().toLowerCase();
            if (command) {
                await this.handleCommand(command);
            }
            if (command !== 'exit') {
                this.rl.prompt();
            }
        }).on('close', () => {
            console.log(chalk.yellow('\n👋 Encerrando NetView...'));
            process.exit(0);
        });
    }
    async handleCommand(command) {
        switch (command) {
            case 'wa-connect':
                this.printAsyncMessage(chalk.yellow('🔄 Iniciando conexão com o WhatsApp...'));
                await this.server.whatsappClient.initializeWhatsApp().catch(err => {
                });
                break;
            case 'wa-disconnect':
                await this.server.whatsappClient.disconnectWhatsApp();
                break;
            case 'wa-status':
                await this.showWhatsAppStatus(false);
                break;
            case 'wa-groups':
                await this.listWhatsAppGroups();
                break;
            case 'wa-set':
                await this.selectGroup();
                break;
            case 'wa-test':
                await this.testWhatsAppMessage();
                break;
            case 'wa-debug':
                console.log(chalk.blue('ℹ️  Ativando diagnóstico. As informações serão exibidas nos logs.'));
                await this.server.whatsappClient.debugWhatsApp();
                break;
            case 'devices':
                this.showDevices();
                break;
            case 'logs-toggle':
                this.toggleConsoleLogs();
                break;
            case 'logs':
                await this.showFileLogs();
                break;
            case 'clear':
                console.clear();
                break;
            case 'help':
                this.showHelp();
                break;
            case 'exit':
                await this.exitProgram();
                break;
            default:
                console.log(chalk.red(`❌ Comando não reconhecido: "${command}". Digite "help" para ajuda.`));
        }
    }
    showHelp() {
        console.log('\n' + chalk.bold.yellow(''.padStart(50, '=')));
        console.log(chalk.bold.yellow('📊 COMANDOS DISPONÍVEIS'));
        console.log(chalk.bold.yellow(''.padStart(50, '=')));
        console.log(chalk.cyan('WhatsApp:'));
        console.log('  wa-connect      - Conectar ao WhatsApp (gera QR Code)');
        console.log('  wa-disconnect   - Desconectar do WhatsApp');
        console.log('  wa-status       - Ver status da conexão com o WhatsApp');
        console.log('  wa-groups       - Listar grupos disponíveis');
        console.log('  wa-set          - Selecionar grupo para notificações');
        console.log('  wa-test         - Enviar mensagem de teste para o grupo');
        console.log('  wa-debug        - Gera um log detalhado do estado do WhatsApp');
        console.log(chalk.cyan('\nSistema:'));
        console.log('  devices         - Ver dispositivos monitorados e seus status');
        console.log('  logs-toggle     - Ativar/desativar exibição de logs no console');
        console.log('  logs            - Ver as últimas 20 linhas do arquivo de log');
        console.log('  clear           - Limpar a tela do console');
        console.log('  help            - Mostrar esta ajuda');
        console.log('  exit            - Sair do programa');
        console.log(chalk.bold.yellow(''.padStart(50, '=')));
    }
    async showWhatsAppStatus(isAsync = false) {
        const status = this.server.whatsappClient.getConnectionStatus();
        const statusEmoji = this.getStatusEmoji(status);
        const statusText = this.getStatusText(status);
        const groupName = await this.getGroupName();
        const message = `\n${chalk.magenta('--- STATUS WHATSAPP ---')}\n  Conexão: ${statusEmoji} ${statusText}\n  Grupo: ${groupName}\n${chalk.magenta('-----------------------')}`;
        if (isAsync) {
            this.printAsyncMessage(message);
        } else {
            console.log(message);
        }
    }
    async listWhatsAppGroups() {
        try {
            const groups = await this.server.whatsappClient.listGroups();
            if (groups.length === 0) {
                console.log(chalk.yellow('❌ Nenhum grupo encontrado. Verifique se o WhatsApp está conectado e se você participa de grupos.'));
                return;
            }
            console.log(chalk.bold.cyan('\n===== 📝 LISTA DE GRUPOS ====='));
            const currentGroupId = this.server.notificationGroupId;
            groups.forEach((group, index) => {
                const isCurrent = currentGroupId === group.id._serialized;
                const marker = isCurrent ? chalk.green('🔔 ') : '   ';
                console.log(`${marker}[${chalk.bold(index + 1)}] ${chalk.white(group.name)} (${group.participantCount} membros)`);
            });
            console.log(chalk.cyan('==============================='));
        } catch (error) {
            console.log(chalk.red(`❌ Erro ao listar grupos: ${error.message}`));
        }
    }
    async selectGroup() {
        await this.listWhatsAppGroups();
        await new Promise(resolve => {
            this.rl.question('📝 Digite o número do grupo (ou 0 para cancelar): ', async (answer) => {
                if (answer.trim() === '0') {
                    console.log('Operação cancelada.');
                    resolve();
                    return;
                }
                try {
                    const groups = await this.server.whatsappClient.listGroups();
                    const groupIndex = parseInt(answer, 10) - 1;
                    if (isNaN(groupIndex) || groupIndex < 0 || groupIndex >= groups.length) {
                        console.log(chalk.red('Número de grupo inválido.'));
                        resolve();
                        return;
                    }
                    const selectedGroup = groups[groupIndex];
                    const groupName = await this.server.whatsappClient.setGroup(selectedGroup.id._serialized);
                    console.log(chalk.green(`\n✅ Grupo "${groupName}" configurado com sucesso! As notificações serão enviadas para lá.`));
                } catch (error) {
                    console.log(chalk.red(`\n❌ Falha ao configurar grupo: ${error.message}`));
                }
                resolve();
            });
        });
        this.rl.prompt();
    }
    async testWhatsAppMessage() {
        if (!this.server.whatsappClient.canSendNotifications()) {
            console.log(chalk.red('❌ Não é possível enviar. Conecte o WhatsApp e configure um grupo primeiro.'));
            return;
        }
        console.log(chalk.yellow('📤 Enviando mensagem de teste...'));
        const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const testMessage = `🧪 *Mensagem de Teste - NetView*\n\nSe você recebeu isso, está tudo funcionando!\nData/Hora: ${timestamp}`;
        const success = await this.server.whatsappClient.sendMessage(testMessage);
        if (success) {
            console.log(chalk.green('✅ Mensagem de teste enviada com sucesso!'));
        } else {
            console.log(chalk.red('❌ Falha ao enviar mensagem de teste. Verifique os logs.'));
        }
    }
    showDevices() {
        const devices = this.server.deviceStates;
        const deviceCount = Object.keys(devices).length;
        console.log(chalk.bold.cyan('\n===== 🖥️ DISPOSITIVOS MONITORADOS ====='));
        if (deviceCount === 0) {
            console.log('Nenhum dispositivo configurado no arquivo `devices.json`.');
            return;
        }
        Object.entries(devices).forEach(([ip, state]) => {
            const statusIcon = state.isOnline ? '🟢' : '🔴';
            const statusText = state.isOnline ? chalk.green('ONLINE') : chalk.red('OFFLINE');
            const lastSeen = state.lastSeen ? new Date(state.lastSeen).toLocaleString('pt-BR') : 'Nunca';
            console.log(`${statusIcon} ${chalk.white(ip)} - ${statusText} (Visto por último: ${lastSeen})`);
        });
        console.log(chalk.cyan('======================================'));
    }
    async showFileLogs() {
        try {
            const logPath = path.join(__dirname, '../../logs/netview.log');
            if (fs.existsSync(logPath)) {
                const logs = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).slice(-20);
                console.log(chalk.bold.yellow('\n===== 📝 ÚLTIMOS 20 LOGS DO ARQUIVO ====='));
                logs.forEach(log => console.log(chalk.gray(log)));
                console.log(chalk.yellow('=========================================='));
            } else {
                console.log(chalk.red('❌ Arquivo de log não encontrado.'));
            }
        } catch (error) {
            console.log(chalk.red(`❌ Erro ao ler logs: ${error.message}`));
        }
    }
    toggleConsoleLogs() {
        this.consoleLogsEnabled = !this.consoleLogsEnabled;
        const status = this.consoleLogsEnabled ? chalk.green('ATIVADOS') : chalk.red('DESATIVADOS');
        this.printAsyncMessage(chalk.yellow(`\n[SISTEMA] Logs no console foram ${status}.`));
    }
    async exitProgram() {
        await new Promise(resolve => {
            this.rl.question('Tem certeza que deseja sair? (s/n): ', async (answer) => {
                if (answer.toLowerCase() === 's') {
                    if (this.server.whatsappClient.getConnectionStatus() !== 'disconnected') {
                        logger.info("Desconectando o WhatsApp antes de sair...");
                        await this.server.whatsappClient.disconnectWhatsApp();
                    }
                    this.rl.close();
                } else {
                    console.log('Saída cancelada.');
                    this.rl.prompt();
                    resolve();
                }
            });
        });
    }
    getStatusEmoji = (status) => ({ connected: '🟢', connecting: '🟡', disconnected: '🔴' }[status] || '⚪');
    getStatusText = (status) => ({ connected: chalk.green('Conectado'), connecting: chalk.yellow('Conectando...'), disconnected: chalk.red('Desconectado') }[status] || chalk.grey('Desconhecido'));
    async getGroupName() {
        const groupId = this.server.notificationGroupId;
        if (!groupId) return chalk.red('Nenhum');
        if (this.server.whatsappClient.getConnectionStatus() !== 'connected') {
            return chalk.yellow(`ID: ...${groupId.slice(-15)} (desconectado)`);
        }
        try {
            const group = await this.server.whatsappClient.whatsappClient.getChatById(groupId);
            return group ? chalk.green(group.name) : chalk.red('Grupo não encontrado');
        } catch {
            return chalk.red('Erro ao buscar nome');
        }
    }
}
module.exports = { CliManager };
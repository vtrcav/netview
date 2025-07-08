const readline = require('readline');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/Logger');
class CliManager {
    constructor(server) {
        this.server = server;
        this.rl = null; 
        this.consoleLogsEnabled = false;
    }
    printAsyncMessage(message) {
        if (this.rl) {
            readline.cursorTo(process.stdout, 0);
            readline.clearLine(process.stdout, 0);
            console.log(message);
            this.rl.prompt(true);
        } else {
            console.log(message);
        }
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
            this.printAsyncMessage(chalk.yellow('📱 Escaneie o QR Code abaixo com seu WhatsApp: '));
            qrcode.generate(qr, { small: true }, (qrCodeString) => {
                console.log();
                console.log(qrCodeString);
                if (this.rl) {
                    this.rl.prompt(true);
                }
            });
        });
        waEvents.on('status_change', (data) => {
            this.showWhatsAppStatus(true, data);
        });
    }
    async start() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.bold.green('NetView > ')
        });

        this.registerEventListeners();

        this.showBanner();
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
            console.log();
            console.log(chalk.bold.yellow('\n'.padStart(51, '=')));
            console.log(chalk.bold.yellow('👋 Encerrando NetView...'));
            console.log(chalk.gray('   Até logo! 😊'));
            console.log();
            console.log();
            process.exit(0);
        });
    }
    async handleCommand(command) {
        switch (command) {
            case 'wa-connect':
                this.printAsyncMessage(chalk.yellow('🔄 Iniciando conexão com o WhatsApp...'));
                await this.server.whatsappClient.initializeWhatsApp().catch(err => { });
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
            case 'wa-reset':
                await this.resetWhatsAppConfig();
                break;
            case 'devices':
                this.showDevices();
                break;
            case 'device-add':
                await this.addDevice();
                break;
            case 'device-edit':
                await this.editDevice();
                break;
            case 'device-history':
                await this.showDeviceHistory();
                break;
            case 'device-remove':
                await this.removeDevice();
                break;
            case 'logs-toggle':
                this.toggleConsoleLogs();
                break;
            case 'logs':
                await this.showFileLogs();
                break;
            case 'config-show':
                await this.showServerConfig();
                break;
            case 'config-set':
                await this.setServerConfig();
                break;
            case 'clear':
                this.showBanner();
                break;
            case 'help':
                this.showHelp();
                break;
            case 'about':
                this.showAbout();
                break;
            case 'exit':
                await this.exitProgram();
                break;
            default:
                console.log(chalk.red(`❌ Comando não reconhecido: "${command}". Digite "help" para ajuda.`));
        }
    }
    showBanner() {
        console.clear();
        console.log(chalk.bold.cyan(''.padStart(50, '=')));
        console.log('  ' + chalk.bold.cyan('🛰️ Bem-vindo ao NetView v3 - CLI'));
        console.log('  ' + chalk.gray('   Sistema de monitoramento de rede'));
        console.log(chalk.bold.cyan(''.padStart(50, '=')));
    }
    showHelp() {
        const commands = {
            'WhatsApp': [
                { cmd: 'wa-connect', desc: 'Conectar ao WhatsApp (gera QR Code)' },
                { cmd: 'wa-disconnect', desc: 'Desconectar do WhatsApp' },
                { cmd: 'wa-status', desc: 'Ver status da conexão com o WhatsApp' },
                { cmd: 'wa-groups', desc: 'Listar grupos disponíveis' },
                { cmd: 'wa-set', desc: 'Selecionar grupo para notificações' },
                { cmd: 'wa-test', desc: 'Enviar mensagem de teste para o grupo' },
                { cmd: 'wa-debug', desc: 'Gera um log detalhado do estado do WhatsApp' },
                { cmd: 'wa-reset', desc: 'Apaga a sessão salva do WhatsApp (força novo QR Code)' }
            ],
            'Sistema': [
                { cmd: 'devices', desc: 'Ver dispositivos monitorados e seus status' },
                { cmd: 'device-add', desc: 'Adicionar um novo dispositivo para monitoramento' },
                { cmd: 'device-edit', desc: 'Editar as informações de um dispositivo existente' },
                { cmd: 'device-history', desc: 'Exibir o histórico de status de um dispositivo' },
                { cmd: 'device-remove', desc: 'Remover um dispositivo existente' },
                { cmd: 'logs-toggle', desc: 'Ativar/desativar exibição de logs no console' },
                { cmd: 'logs', desc: 'Ver as últimas 20 linhas do arquivo de log' },
                { cmd: 'config-show', desc: 'Exibir a configuração atual do servidor (host e porta)' },
                { cmd: 'config-set', desc: 'Alterar o host e a porta do servidor (requer reinicialização)' },
                { cmd: 'clear', desc: 'Limpar a tela do console' },
                { cmd: 'help', desc: 'Mostrar esta ajuda' },
                { cmd: 'about', desc: 'Informações sobre o NetView' },
                { cmd: 'exit', desc: 'Sair do programa' }
            ]
        };
        const allCommands = [...commands.WhatsApp, ...commands.Sistema];
        const maxCmdLength = Math.max(...allCommands.map(c => c.cmd.length));
        const pad = maxCmdLength + 4;
        console.log('\n' + chalk.bold.yellow(''.padStart(50, '=')));
        console.log(chalk.bold.yellow('  📊 COMANDOS DISPONÍVEIS'));
        console.log(chalk.bold.yellow(''.padStart(50, '=')));
        for (const category in commands) {
            console.log(chalk.cyan(`\n  ${category}:`));
            commands[category].forEach(({ cmd, desc }) => {
                console.log(`    ${chalk.white(cmd.padEnd(pad))} ${chalk.gray('-')} ${chalk.gray(desc)}`);
            });
        }
        console.log(chalk.bold.yellow(''.padStart(50, '=')));
    }
    showAbout() {
        console.log('\n' + chalk.bold.cyan(''.padStart(50, '=')));
        console.log('  ' + chalk.bold.cyan('🔍 SOBRE O NETVIEW') + chalk.bold.green(' v3.2.0'));
        console.log();
        console.log('  ' + chalk.gray('NetView é um sistema de monitoramento de rede que combina:'));
        console.log('  ' + chalk.gray('• Verificação de dispositivos em tempo real via ping'));
        console.log('  ' + chalk.gray('• Notificações instantâneas por WhatsApp'));
        console.log('  ' + chalk.gray('• Interface de linha de comando (CLI) intuitiva'));
        console.log('  ' + chalk.gray('• Dashboard web responsivo para visualização geral'));
        console.log();
        console.log('  ' + chalk.white('Criado por ') + chalk.bold.yellow('Vitor Cavalcante'));
        console.log('  ' + chalk.blue('https://github.com/vtrcav'));
        console.log();
        console.log(chalk.bold.cyan(''.padStart(50, '=')) + '\n');
    }
    async showWhatsAppStatus(isAsync = false, eventData = null) {
        const status = eventData ? eventData.status : this.server.whatsappClient.getConnectionStatus();
        const reason = eventData ? eventData.reason : null;
        const statusEmoji = this.getStatusEmoji(status);
        const statusText = this.getStatusText(status);
        const groupName = await this.getGroupName();
        let reasonText = '';
        if (reason) {
            reasonText = `  ${chalk.white('Motivo:')}  ${chalk.yellow(reason)}`;
        }
        const output = [
            `\n${chalk.bold.magenta(''.padStart(35, '='))}`,
            `${chalk.bold.magenta('  📱 STATUS DO WHATSAPP')}`,
            `${chalk.bold.magenta(''.padStart(35, '='))}`,
            `  ${chalk.white('Conexão:')} ${statusEmoji} ${statusText}`,
            reasonText,
            `  ${chalk.white('Grupo:')}   ${groupName}`,
            `${chalk.bold.magenta(''.padStart(35, '='))}`
        ].filter(Boolean).join('\n');
        if (isAsync) {
            this.printAsyncMessage(output);
        } else {
            console.log(output);
        }
    }
    async resetWhatsAppConfig() {
        await new Promise(resolve => {
            this.rl.question(chalk.yellow('❓ Tem certeza que deseja apagar a sessão do WhatsApp? Isso exigirá uma nova leitura de QR Code. (s/n): '), async (answer) => {
                if (answer.toLowerCase() !== 's') {
                    console.log(chalk.gray('Operação cancelada.'));
                    resolve();
                    this.rl.prompt();
                    return;
                }
                console.log(chalk.yellow('🧹 Iniciando limpeza...'));
                const success = await this.server.whatsappClient.clearSession();
                if (success) {
                    console.log(chalk.bold.green('\n✅ Limpeza concluída! Use "wa-connect" para iniciar uma nova sessão.'));
                } else {
                    console.log(chalk.red('❌ Erro ao apagar a configuração. Verifique os logs para mais detalhes.'));
                }
                resolve();
                this.rl.prompt();
            });
        });
    }
    async listWhatsAppGroups() {
        try {
            const groups = await this.server.whatsappClient.listGroups();
            if (groups.length === 0) {
                console.log(chalk.yellow('❌ Nenhum grupo encontrado. Verifique se o WhatsApp está conectado e se você participa de grupos.'));
                return;
            }
            console.log(chalk.bold.cyan('\n'.padStart(51, '=')));
            console.log(chalk.bold.cyan('  📝 LISTA DE GRUPOS DISPONÍVEIS'));
            console.log(chalk.bold.cyan(''.padStart(50, '=')));
            const currentGroupId = this.server.notificationGroupId;
            groups.forEach((group, index) => {
                const isCurrent = currentGroupId === group.id._serialized;
                const marker = isCurrent ? chalk.green('🔔 ') : '   ';
                console.log(`${marker}[${chalk.bold(index + 1)}] ${chalk.white(group.name)} ${chalk.gray(`(${group.participantCount} membros)`)}`);
            });
            console.log(chalk.bold.cyan(''.padStart(50, '=')));
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
        const timestamp = new Date().toLocaleString('pt-BR');
        const testMessage = `🧪 *Mensagem de Teste - NetView v3*\n\nSe você recebeu isto, está tudo funcionando!\nData/Hora: ${timestamp}\n\n_Enviado pelo NetView_`;
        const success = await this.server.whatsappClient.sendMessage(testMessage);
        if (success) {
            console.log(chalk.green('✅ Mensagem de teste enviada com sucesso!'));
        } else {
            console.log(chalk.red('❌ Falha ao enviar mensagem de teste. Verifique os logs.'));
        }
    }
    getDevicesConfigPath() {
        return path.resolve(__dirname, '../../config/devices.json');
    }
    async getDevicesConfig() {
        const configPath = this.getDevicesConfigPath();
        const configDir = path.dirname(configPath);
        try {
            if (!fs.existsSync(configDir)) {
                await fs.promises.mkdir(configDir, { recursive: true });
            }
            if (!fs.existsSync(configPath)) {
                await fs.promises.writeFile(configPath, '{}', 'utf8');
                return {};
            }
            const fileContent = await fs.promises.readFile(configPath, 'utf8');
            return JSON.parse(fileContent);
        } catch (error) {
            this.printAsyncMessage(chalk.red(`❌ Erro ao ler a configuração de dispositivos: ${error.message}`));
            return null;
        }
    }
    async saveDevicesConfig(devicesConfig) {
        const configPath = this.getDevicesConfigPath();
        try {
            const jsonString = JSON.stringify(devicesConfig, null, 2); await fs.promises.writeFile(configPath, jsonString, 'utf8');
            return true;
        } catch (error) {
            this.printAsyncMessage(chalk.red(`❌ Erro ao salvar a configuração de dispositivos: ${error.message}`));
            return false;
        }
    }
    async addDevice() {
        const askQuestion = (query) => new Promise(resolve => this.rl.question(query, resolve));
        console.log(chalk.bold.cyan('\n'.padStart(51, '=')));
        console.log(chalk.bold.cyan(' ➕ ADICIONAR NOVO DISPOSITIVO'));
        console.log(chalk.bold.cyan(''.padStart(50, '=')));
        const devices = await this.getDevicesConfig();
        if (devices === null) return; const name = await askQuestion('Nome do dispositivo (ex: Servidor Principal): ');
        if (devices[name]) {
            console.log(chalk.red('❌ Já existe um dispositivo com esse nome. Operação cancelada.'));
            this.rl.prompt();
            return;
        }
        const newDevice = {};
        newDevice.ip = await askQuestion(`Endereço IP de "${name}": `);
        newDevice.description = await askQuestion(`Descrição de "${name}": `);
        newDevice.category = await askQuestion(`Categoria (ex: Roteadores, Servidores): `);
        newDevice.icon = await askQuestion(`Ícone (ex: server, router, desktop): `);
        const is24h = await askQuestion('Monitorar 24h? (s/n): ');
        if (is24h.toLowerCase() === 's') {
            newDevice['24h'] = true;
        } else {
            console.log(chalk.yellow('Configurando horário de funcionamento...'));
            newDevice.workingHours = {
                weekday: {
                    start: parseInt(await askQuestion('Dia de semana - Hora de início (0-23): '), 10),
                    end: parseInt(await askQuestion('Dia de semana - Hora de fim (0-23): '), 10)
                },
                weekend: {
                    start: parseInt(await askQuestion('Fim de semana - Hora de início (0-23): '), 10),
                    end: parseInt(await askQuestion('Fim de semana - Hora de fim (0-23): '), 10)
                }
            };
        }
        devices[name] = newDevice;
        const success = await this.saveDevicesConfig(devices);
        if (success) {
            console.log(chalk.green(`\n✅ Dispositivo "${name}" adicionado com sucesso!`));
            console.log(chalk.yellow('O NetView começará a monitorá-lo em breve.'));
        }
        this.rl.prompt();
    }
    async editDevice() {
        const askQuestion = (query) => new Promise(resolve => this.rl.question(query, resolve));
        console.log(chalk.bold.cyan('\n'.padStart(51, '=')));
        console.log(chalk.bold.cyan(' ✏️ EDITAR DISPOSITIVO'));
        console.log(chalk.bold.cyan(''.padStart(50, '=')));
        const devices = await this.getDevicesConfig();
        if (!devices || Object.keys(devices).length === 0) {
            console.log(chalk.yellow('Nenhum dispositivo configurado para editar.'));
            this.rl.prompt();
            return;
        }
        console.log('Selecione o dispositivo para editar (digite o número):');
        const deviceNames = Object.keys(devices);
        deviceNames.forEach((name, index) => {
            console.log(`  [${chalk.bold(index + 1)}] ${chalk.white(name)} ${chalk.gray(`(${devices[name].ip})`)}`);
        });
        console.log(`  [${chalk.bold(0)}] ${chalk.gray('Cancelar')}`);
        const choice = await askQuestion('\nNúmero do dispositivo: ');
        const index = parseInt(choice, 10);
        if (isNaN(index) || index < 0 || index > deviceNames.length) {
            console.log(chalk.red('Seleção inválida. Operação cancelada.'));
            this.rl.prompt();
            return;
        }
        if (index === 0) {
            console.log(chalk.gray('Operação cancelada.'));
            this.rl.prompt();
            return;
        }
        const deviceNameToEdit = deviceNames[index - 1];
        const currentDevice = devices[deviceNameToEdit];
        const newDeviceData = {};
        console.log(chalk.yellow(`\nEditando "${deviceNameToEdit}". Pressione ENTER para manter o valor atual.`));
        const newNameInput = await askQuestion(`> Novo nome (atual: ${chalk.cyan(deviceNameToEdit)}): `);
        const newDeviceName = newNameInput.trim() || deviceNameToEdit;
        if (newDeviceName !== deviceNameToEdit && devices[newDeviceName]) {
            console.log(chalk.red(`❌ Erro: Já existe um dispositivo com o nome "${newDeviceName}".`));
            console.log(chalk.red('Operação cancelada para evitar sobrescrever dados.'));
            this.rl.prompt();
            return;
        }
        const ipInput = await askQuestion(`> Novo IP (atual: ${chalk.cyan(currentDevice.ip)}): `);
        newDeviceData.ip = ipInput.trim() || currentDevice.ip;
        const descInput = await askQuestion(`> Nova descrição (atual: ${chalk.cyan(currentDevice.description)}): `);
        newDeviceData.description = descInput.trim() || currentDevice.description;
        const categoryInput = await askQuestion(`> Nova categoria (atual: ${chalk.cyan(currentDevice.category)}): `);
        newDeviceData.category = categoryInput.trim() || currentDevice.category;
        const iconInput = await askQuestion(`> Novo ícone (atual: ${chalk.cyan(currentDevice.icon)}): `);
        newDeviceData.icon = iconInput.trim() || currentDevice.icon;
        const currentScheduleType = currentDevice['24h'] ? '24h' : 'Horário Específico';
        const changeSchedule = await askQuestion(`> O monitoramento atual é "${chalk.cyan(currentScheduleType)}". Deseja alterar? (s/n): `);
        if (changeSchedule.toLowerCase() === 's') {
            const is24h = await askQuestion('> O novo monitoramento será 24h? (s/n): ');
            if (is24h.toLowerCase() === 's') {
                newDeviceData['24h'] = true;
            } else {
                console.log(chalk.yellow('Configurando novo horário de funcionamento...'));
                newDeviceData.workingHours = {
                    weekday: { start: parseInt(await askQuestion('> Dia de semana - Hora de início (0-23): '), 10), end: parseInt(await askQuestion('> Dia de semana - Hora de fim (0-23): '), 10) },
                    weekend: { start: parseInt(await askQuestion('> Fim de semana - Hora de início (0-23): '), 10), end: parseInt(await askQuestion('> Fim de semana - Hora de fim (0-23): '), 10) }
                };
            }
        } else {
            if (currentDevice['24h']) { newDeviceData['24h'] = true; }
            else { newDeviceData.workingHours = currentDevice.workingHours; }
        }
        if (newDeviceName !== deviceNameToEdit) {
            devices[newDeviceName] = newDeviceData;
            delete devices[deviceNameToEdit];
        } else {
            devices[deviceNameToEdit] = newDeviceData;
        }
        const success = await this.saveDevicesConfig(devices);
        if (success) {
            console.log(chalk.green(`\n✅ Dispositivo atualizado com sucesso!`));
            if (newDeviceName !== deviceNameToEdit) {
                console.log(chalk.green(`   Renomeado de "${deviceNameToEdit}" para "${newDeviceName}".`));
            }
            console.log(chalk.gray(`O NetView aplicará as alterações no próximo ciclo de verificação.`));
        }
        this.rl.prompt();
    }
    getServerConfigPath() {
        return path.resolve(__dirname, '../../config/server.json');
    }
    async showServerConfig() {
        const configPath = this.getServerConfigPath();
        console.log(chalk.bold.cyan('\n'.padStart(50, '=')));
        console.log(chalk.bold.cyan(' ⚙️  CONFIGURAÇÃO ATUAL DO SERVIDOR'));
        console.log(chalk.bold.cyan(''.padStart(50, '=')));
        try {
            if (fs.existsSync(configPath)) {
                const rawConfig = await fs.promises.readFile(configPath, 'utf8');
                const config = JSON.parse(rawConfig);
                console.log(`  ${chalk.white('Host:')} \t${chalk.yellow(config.host)}`);
                console.log(`  ${chalk.white('Porta:')}\t${chalk.yellow(config.port)}`);
            } else {
                console.log(chalk.yellow('Arquivo de configuração do servidor não encontrado. Usando padrões.'));
            }
        } catch (error) {
            console.log(chalk.red(`❌ Erro ao ler a configuração: ${error.message}`));
        }
        console.log(chalk.bold.cyan(''.padStart(50, '=')));
    }
    async setServerConfig() {
        const askQuestion = (query) => new Promise(resolve => this.rl.question(query, resolve));
        const configPath = this.getServerConfigPath();
        let currentConfig = { host: '0.0.0.0', port: 80 }; try {
            if (fs.existsSync(configPath)) {
                const rawConfig = await fs.promises.readFile(configPath, 'utf8');
                currentConfig = JSON.parse(rawConfig);
            }
        } catch (error) {
            console.log(chalk.red(`Não foi possível ler a configuração atual, mas você pode definir uma nova. Erro: ${error.message}`));
        }
        console.log(chalk.yellow('\nAlterando configuração do servidor. Pressione ENTER para manter o valor atual.'));
        const newHostInput = await askQuestion(`> Novo Host (atual: ${chalk.cyan(currentConfig.host)}): `);
        const newHost = newHostInput.trim() || currentConfig.host;
        const newPortInput = await askQuestion(`> Nova Porta (atual: ${chalk.cyan(currentConfig.port)}): `);
        let newPort = parseInt(newPortInput.trim(), 10);
        if (isNaN(newPort)) {
            newPort = currentConfig.port;
        } else if (newPort <= 0 || newPort > 65535) {
            console.log(chalk.red('❌ Porta inválida. Deve ser um número entre 1 e 65535. Operação cancelada.'));
            this.rl.prompt();
            return;
        }
        const newConfig = { host: newHost, port: newPort };
        try {
            await fs.promises.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
            console.log(chalk.green('\n✅ Configuração salva com sucesso!'));
            console.log(chalk.bold.yellow(''.padStart(60, '!')));
            console.log(chalk.bold.yellow('  IMPORTANTE: Por favor, REINICIE o servidor para que as'));
            console.log(chalk.bold.yellow('  alterações de host e porta tenham efeito.'));
            console.log(chalk.bold.yellow(''.padStart(60, '!')));
        } catch (error) {
            console.log(chalk.red(`❌ Erro ao salvar a nova configuração: ${error.message}`));
        }
        this.rl.prompt();
    }
    async showDeviceHistory() {
        const askQuestion = (query) => new Promise(resolve => this.rl.question(query, resolve));
        console.log(chalk.bold.cyan('\n'.padStart(51, '=')));
        console.log(chalk.bold.cyan(' 📜 HISTÓRICO DE DISPOSITIVO'));
        console.log(chalk.bold.cyan(''.padStart(50, '=')));
        const devices = await this.getDevicesConfig();
        if (!devices || Object.keys(devices).length === 0) {
            console.log(chalk.yellow('Nenhum dispositivo configurado.'));
            this.rl.prompt();
            return;
        }
        console.log('Selecione o dispositivo para ver o histórico:');
        const deviceNames = Object.keys(devices);
        deviceNames.forEach((name, index) => {
            console.log(`  [${chalk.bold(index + 1)}] ${chalk.white(name)}`);
        });
        console.log(`  [${chalk.bold(0)}] ${chalk.gray('Cancelar')}`);
        const choice = await askQuestion('\nNúmero do dispositivo: ');
        const index = parseInt(choice, 10);
        if (isNaN(index) || index < 0 || index > deviceNames.length) {
            console.log(chalk.red('Seleção inválida.')); this.rl.prompt(); return;
        }
        if (index === 0) {
            console.log(chalk.gray('Operação cancelada.')); this.rl.prompt(); return;
        }
        const deviceNameToQuery = deviceNames[index - 1];
        console.log(chalk.yellow(`\nBuscando histórico para "${deviceNameToQuery}"...`));
        const logFile = path.resolve(__dirname, '../../logs/history.jsonl');
        if (!fs.existsSync(logFile)) {
            console.log(chalk.yellow('Nenhum histórico registrado ainda.'));
            this.rl.prompt();
            return;
        }
        try {
            const fileContent = await fs.promises.readFile(logFile, 'utf8');
            const allEvents = fileContent.split('\n')
                .filter(line => line.trim() !== '').map(line => JSON.parse(line)); const deviceHistory = allEvents
                    .filter(event => event.device === deviceNameToQuery)
                    .slice(-20); if (deviceHistory.length === 0) {
                        console.log(chalk.yellow(`Nenhum evento de mudança de status encontrado para "${deviceNameToQuery}".`));
                    } else {
                console.log(chalk.bold.cyan(''.padStart(50, '=')));
                console.log(chalk.bold.cyan(` 📊 ÚLTIMOS EVENTOS DE STATUS - ${deviceNameToQuery}`));
                console.log(chalk.bold.cyan(''.padStart(50, '=')));
                deviceHistory.forEach(event => {
                    const date = new Date(event.timestamp);
                    const formattedDate = date.toLocaleString('pt-BR');
                    const statusText = event.status === 'Online'
                        ? chalk.green.bold('ONLINE')
                        : chalk.red.bold('OFFLINE');
                    console.log(`  ${chalk.gray(formattedDate)} - ${statusText}`);
                });
                console.log(chalk.bold.cyan(''.padStart(50, '=')));
            }
        } catch (error) {
            console.log(chalk.red(`❌ Erro ao ler o arquivo de histórico: ${error.message}`));
        }
        this.rl.prompt();
    }
    async removeDevice() {
        console.log(chalk.bold.cyan('\n'.padStart(51, '=')));
        console.log(chalk.bold.cyan(' ➖ REMOVER DISPOSITIVO'));
        console.log(chalk.bold.cyan(''.padStart(50, '=')));
        const devices = await this.getDevicesConfig();
        if (devices === null) return;
        const deviceNames = Object.keys(devices);
        if (deviceNames.length === 0) {
            console.log(chalk.yellow('Nenhum dispositivo para remover.'));
            this.rl.prompt();
            return;
        }
        console.log('Selecione o dispositivo para remover (digite o número):');
        deviceNames.forEach((name, index) => {
            console.log(`  [${chalk.bold(index + 1)}] ${chalk.white(name)} ${chalk.gray(`(${devices[name].ip})`)}`);
        });
        console.log(`  [${chalk.bold(0)}] ${chalk.gray('Cancelar')}`);
        const askQuestion = (query) => new Promise(resolve => this.rl.question(query, resolve));
        const choice = await askQuestion('\nNúmero do dispositivo: ');
        const index = parseInt(choice, 10);
        if (isNaN(index) || index < 0 || index > deviceNames.length) {
            console.log(chalk.red('Seleção inválida. Operação cancelada.'));
            this.rl.prompt();
            return;
        }
        if (index === 0) {
            console.log(chalk.gray('Operação cancelada.'));
            this.rl.prompt();
            return;
        }
        const deviceNameToRemove = deviceNames[index - 1];
        const confirm = await askQuestion(chalk.red(`Tem certeza que deseja remover "${deviceNameToRemove}"? (s/n): `));
        if (confirm.toLowerCase() === 's') {
            delete devices[deviceNameToRemove];
            const success = await this.saveDevicesConfig(devices);
            if (success) {
                console.log(chalk.green(`\n✅ Dispositivo "${deviceNameToRemove}" removido com sucesso!`));
                console.log(chalk.yellow('Ele não será mais verificado pelo sistema.'));
            }
        } else {
            console.log(chalk.gray('Operação cancelada.'));
        }
        this.rl.prompt();
    }
    showDevices() {
        const devices = this.server.deviceStates;
        const totalDeviceCount = Object.values(devices).reduce((acc, categoryArray) => acc + categoryArray.length, 0);
        console.log(chalk.bold.cyan('\n'.padStart(51, '=')));
        console.log(chalk.bold.cyan('  🖥️  DISPOSITIVOS MONITORADOS'));
        console.log(chalk.bold.cyan(''.padStart(50, '=')));
        if (totalDeviceCount === 0) {
            console.log('  ' + chalk.yellow('Nenhum dispositivo configurado.'));
        } else {
            Object.entries(devices).forEach(([category, devicesInCategory]) => {
                console.log(`\n  ${chalk.bold.yellow(category)}:`);
                devicesInCategory.forEach(device => {
                    const isDeviceOnline = device.status === 'Online';
                    const ipAddress = device.ip || 'IP não encontrado';
                    const statusIcon = isDeviceOnline ? '🟢' : '🔴';
                    const statusText = isDeviceOnline ? chalk.green('ONLINE') : chalk.red('OFFLINE');
                    const lastSeen = device.timestamp || 'Nunca';
                    console.log(`    ${statusIcon} ${chalk.white(ipAddress)} - ${statusText} ${chalk.gray(`(Visto por último: ${lastSeen})`)}`);
                });
            });
        }
        console.log(chalk.bold.cyan(''.padStart(50, '=')));
    }
    async showFileLogs() {
        try {
            const logPath = path.join(__dirname, '../../logs/netview.log');
            if (fs.existsSync(logPath)) {
                const logs = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).slice(-20);
                console.log(chalk.bold.yellow('\n'.padStart(51, '=')));
                console.log(chalk.bold.yellow('  📝 ÚLTIMOS 20 LOGS DO ARQUIVO'));
                console.log(chalk.bold.yellow(''.padStart(50, '=')));
                logs.forEach(log => console.log(chalk.gray('  ' + log)));
                console.log(chalk.bold.yellow(''.padStart(50, '=')));
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
# NetView 3.0.0 - Sistema de monitoramento de rede

![Node.js](https://img.shields.io/badge/Node.js-v18+-green?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)
![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square)

## 📋 Sobre 

**NetView 3.0.0** é uma reengenharia completa do sistema de monitoramento de rede, agora com arquitetura modular, interface web integrada e CLI interativo. Monitora dispositivos via ping, envia notificações por WhatsApp e oferece dashboard em tempo real.

### 🆕 Novidades da versão 3.0.0

- **Arquitetura modular**: código organizado em módulos para melhor manutenção
- **Interface web integrada**: servidor web embutido com dashboard responsivo
- **CLI interativo**: gerenciamento completo via terminal
- **Sistema de logs robusto**: logging detalhado com Winston
- **Configuração via WebSocket**: comunicação em tempo real com a interface

## 🛠️ Tecnologias utilizadas

- **Node.js** 
- **Express.js** - servidor web
- **WebSocket (ws)** - comunicação em tempo real
- **whatsapp-web.js** - integração WhatsApp
- **Puppeteer** - automação do navegador
- **qrcode-terminal** - QR Code no terminal
- **Chalk** - estilização do CLI
- **Winston** - sistema de logs

## 📦 Instalação

### Pré-requisitos

- Node.js v18 ou superior
- npm ou yarn
- WhatsApp instalado no celular (para autenticação)

### Passos de instalação

1. **Clone o repositório**
```bash
git clone https://github.com/vtrcav/netview.git
cd netview
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure os dispositivos**
```bash
mkdir config
```
Crie o arquivo `config/devices.json` com a estrutura:

```json
{
  "Servidor-Principal": {
    "ip": "192.168.1.100",
    "description": "Servidor principal da empresa",
    "category": "Servidores",
    "icon": "server",
    "24h": true
  },
  "Switch-Andar1": {
    "ip": "192.168.1.10",
    "description": "Switch do primeiro andar",
    "category": "Rede",
    "icon": "router",
    "workingHours": {
      "weekday": { "start": 7, "end": 18 },
      "weekend": { "start": 9, "end": 16 }
    }
  }
}
```

4. **Inicie o servidor**
```bash
npm start
```

### Primeira configuração do WhatsApp

1. Execute o servidor
2. No CLI, digite `wa-connect`
3. Escaneie o código QR que aparecerá no terminal
4. Use `wa-groups` para listar seus grupos
5. Use `wa-set` para selecionar o grupo de notificações
6. Teste com `wa-test`

## ⚙️ Configuração

### Estrutura do arquivo devices.json

```json
{
  "nome-do-dispositivo": {
    "ip": "endereço-ip",
    "description": "descrição-do-dispositivo",
    "category": "categoria-do-dispositivo",
    "icon": "ícone-opcional",
    "24h": true/false,
    "workingHours": {
      "weekday": {
        "start": hora_inicio,
        "end": hora_fim
      },
      "weekend": {
        "start": hora_inicio,
        "end": hora_fim
      }
    }
  }
}
```

### Parâmetros de inicialização

```bash
node server.js [PORTA] [HOST]
```

- **PORTA**: Porta do servidor (padrão: 80)
- **HOST**: Endereço de bind (padrão: localhost)

Exemplo:
```bash
node server.js 3000 192.168.1.100
```

## 🚀 Uso

### Interface web

Acesse a interface web em `http://localhost:80/` (ou a porta configurada):

- **Dashboard principal** com status de todos os dispositivos
- **Estatísticas em tempo real** (online, offline, fora de horário)
- **Filtro por categoria** de dispositivos
- **Atualização automática** via WebSocket

### CLI interativo

O CLI é ativado automaticamente ao iniciar o servidor. Comandos disponíveis:

#### Comandos WhatsApp
- `wa-connect`: Conecta ao WhatsApp (exibe QR Code)
- `wa-disconnect`: Desconecta do WhatsApp
- `wa-status`: Status da conexão e grupo configurado
- `wa-groups`: Lista todos os grupos disponíveis
- `wa-set`: Seleciona grupo para notificações
- `wa-test`: Envia mensagem de teste
- `wa-debug`: Log detalhado do cliente WhatsApp

#### Comandos do sistema
- `devices`: Status atual de todos os dispositivos
- `logs-toggle`: Ativa/desativa logs em tempo real
- `logs`: Exibe últimas 20 linhas do log
- `clear`: Limpa a tela
- `help`: Lista todos os comandos
- `exit`: Encerra o programa

### Notificações WhatsApp

O sistema envia automaticamente:

- ⚠️ **Alertas de offline**: quando um dispositivo fica indisponível
- ✅ **Confirmações de online**: quando um dispositivo volta a funcionar
- 📊 **Relatórios de tempo**: duração dos períodos offline

### API WebSocket

O servidor expõe uma API WebSocket para integração:

```javascript
const ws = new WebSocket('ws://localhost:80');

// Eventos disponíveis
ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  switch(message.type) {
    case 'status_update':     // Estado inicial
    case 'device_update':     // Atualização de dispositivo
    case 'state_change':      // Mudança de status
    case 'stats_update':      // Estatísticas atualizadas
    case 'config_updated':    // Configuração recarregada
  }
});

// Comandos disponíveis
ws.send(JSON.stringify({
  type: 'manual_check'        // Verificação manual de todos
}));

ws.send(JSON.stringify({
  type: 'check_device',       // Verificação de dispositivo específico
  device: 'nome-do-dispositivo'
}));
```

## 📁 Estrutura do projeto

```
.
├── config/
│   ├── devices.json
│   └── whatsapp_group.json
├── logs/
│   └── netview.log
├── public/
│   ├── index.html
│   ├── favicon.png
│   └── assets/
│       ├── css/
│       │   └── style.css
│       └── js/
│           └── app.js
├── src/
│   ├── cli/
│   │   └── CliManager.js
│   ├── config/
│   │   └── ConfigManager.js
│   ├── core/
│   │   └── NetViewServer.js
│   ├── network/
│   │   ├── DeviceStateManager.js
│   │   └── PingService.js
│   ├── notifications/
│   │   ├── NotificationManager.js
│   │   └── WhatsAppClient.js
│   ├── utils/
│   │   ├── helpers.js
│   │   ├── Logger.js
│   │   └── TimerManager.js
│   └── websocket/
│       └── WebSocketHandler.js
├── server.js
├── package.json
└── README.md
```

## 🔧 Personalização

### Intervalos de verificação

No código principal, você pode ajustar:

```javascript
this.pingInterval = 5;           // Intervalo entre verificações (segundos)
this.configWatchInterval = 10;   // Verificação do arquivo de config (segundos)
this.retryCount = 4;            // Tentativas de ping por dispositivo
this.concurrentPings = 10;      // Pings simultâneos máximos
```

### Configuração de notificações

```javascript
this.INITIAL_SCAN_DELAY = 60 * 1000;              // Delay inicial após startup
this.OFFLINE_THRESHOLD = 15 * 1000;               // Tempo para considerar offline
```

## 📊 Monitoramento e logs

O sistema gera logs detalhados em `logs/netview.log`:

```
[INFO] Servidor NetView iniciado em localhost:80
[INFO] Cliente WhatsApp está pronto!
[INFO] Configuração de dispositivos carregada. Total: 25
[INFO] ✅ Notificação de offline enviada para dispositivo: Switch-Andar1
[INFO] Status do dispositivo Servidor-Principal: Online (mudou: false)
```

Use `logs-toggle` no CLI para ver logs em tempo real ou `logs` para ver as últimas entradas.

## 🐛 Solução de problemas

### WhatsApp não conecta
```bash
# Limpe o cache de autenticação
rm -rf .wwebjs_auth
# Reinicie o servidor e use wa-connect no CLI
```

### Interface web não carrega
- Verifique se o servidor está rodando na porta correta
- Acesse `http://localhost:PORTA/` no navegador
- Verifique os logs com o comando `logs` no CLI

### Alta utilização de CPU
- Reduza `concurrentPings` para um valor menor
- Aumente `pingInterval` para verificações menos frequentes
- Use `wa-disconnect` se não precisar de notificações WhatsApp

## 🔄 Migração da versão 2.0.0

Para migrar da versão 2.0.0:

1. Faça backup do seu arquivo `config/devices.json`
2. A estrutura do arquivo de dispositivos permanece compatível
3. A configuração do WhatsApp agora é feita via CLI
4. A interface web agora é integrada ao servidor principal

## 📝 Licença

Este projeto está licenciado sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.
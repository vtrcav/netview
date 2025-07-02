# NetView - Sistema simples de monitoramento de rede

![Node.js](https://img.shields.io/badge/Node.js-v18+-green?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)
![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square)

## 📋 Sobre 

**NetView** é um sistema simples de monitoramento de rede em tempo real que combina verificação automatizada de dispositivos via ping, notificações por WhatsApp e interface web responsiva. 

## 🛠️ Tecnologias utilizadas

- **Node.js** 
- **WebSocket (ws)** 
- **whatsapp-web.js** 
- **puppeteer**
- **qrcode-terminal**
- **Vue.js** 
- **Vite**
- **Bootstrap** 
- **Font Awesome**


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
    "category": "Servidores",
    "description": "Servidor principal da empresa",
    "icon": "server",
    "24h": true
  },
  "Switch-Andar1": {
    "ip": "192.168.1.10",
    "category": "Rede",
    "description": "Switch do primeiro andar",
    "icon": "network",
    "workingHours": {
      "weekday": { "start": 7, "end": 18 },
      "weekend": { "start": 9, "end": 16 }
    }
  }
}
```

4. **Inicie o servidor**
```bash
node netview_server.js 
```

### Primeira configuração do WhatsApp

1. Execute o servidor
2. Escaneie o código QR que aparecerá no terminal com seu WhatsApp
3. Aguarde a mensagem de confirmação no grupo configurado

## ⚙️ Configuração

### Estrutura do arquivo devices.json

```json
{
  "nome-do-dispositivo": {
    "ip": "endereço-ip",
    "category": "categoria-do-dispositivo",
    "description": "descrição-opcional",
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
node netview_server.js 
```

- **porta**: Porta do servidor (padrão: 8080)
- **host**: Endereço de bind (padrão: 0.0.0.0)

## 🚀 Uso

### Interface web

A interface web fica na pasta public/. Você pode servir essa pasta com qualquer servidor web (nginx, Apache, etc) ou simplesmente abrir o index.html diretamente no navegador da máquina que exibirá o dashboard

- **Dashboard principal** com status de todos os dispositivos
- **Estatísticas em tempo real** (online, offline, fora de horário)
- **Filtro de dispositivos** de dispositivos específicos

**Configuração da interface web:**

1. Abra o arquivo public/js/app.js em um editor
2. Localize a função chamada connectWebSocket
3. Dentro desta função, você encontrará a const wsHost que inicia a conexão. Substituia 'IP_DO_SERVIDOR_AQUI' pelo IP/hostname do servidor NetView.



### Notificações WhatsApp

O sistema envia automaticamente:

- ⚠️ **Alertas de offline**: quando um dispositivo fica indisponível
- ✅ **Confirmações de online**: quando um dispositivo volta a funcionar
- 📊 **Relatórios de tempo**: duração dos períodos offline

### API webSocket

O servidor expõe uma API WebSocket para integração:

```javascript
const ws = new WebSocket('ws://localhost:8080');

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

### ID do grupo WhatsApp

Para alterar o grupo que recebe as notificações, modifique:

```javascript
this.notificationGroupId = 'SEU_ID_DO_GRUPO@g.us';
```

### Configuração do grupo WhatsApp
1. Execute o servidor e faça login
2. Execute `node acha_grupo.js` para listar grupos
3. Copie o ID do grupo desejado
4. Cole no arquivo de configuração

## 📊 Monitoramento e logs

O sistema gera logs detalhados para monitoramento:

```
[INFO] Servidor NetView iniciado em 0.0.0.0:8080
[INFO] Cliente WhatsApp está pronto!
[INFO] Configuração de dispositivos carregada. Total: 25
[INFO] ✅ Notificação de offline enviada para dispositivo: Switch-Andar1
[INFO] Status do dispositivo Servidor-Principal: Online (mudou: false)
```

## 🐛 Solução de problemas

### WhatsApp não conecta
```bash
# Limpe o cache de autenticação
rm -rf .wwebjs_auth
# Reinicie o servidor e escaneie o QR novamente
```

### Alta utilização de CPU
- Reduza `concurrentPings` para um valor menor
- Aumente `pingInterval` para verificações menos frequentes
# NetView - Sistema de monitoramento de rede

## 📋 Sobre

NetView é um sistema simples de monitoramento de rede via ping. Possui interface web, notificações via WhatsApp e comandos interativos no terminal (CLI).

![Preview do NetView](https://i.imgur.com/BsXJeVb.png)

## 🆕 Novidades da versão 3.1

- **Gerenciamento via CLI**: Adicione, edite e remova dispositivos
- **Histórico de dispositivos**: Visualize o histórico de status de cada dispositivo
- **Configuração de servidor via CLI**: Altere o host/porta do servidor
- **Reset de sessão WhatsApp**: Limpar a sessão salva do WhatsApp pelo CLI

## 🛠️ Tecnologias utilizadas

- **Node.js** - Express.js - servidor web
- **WebSocket (ws)** - comunicação em tempo real
- **whatsapp-web.js** - integração WhatsApp
- **Puppeteer** - automação do navegador
- **qrcode-terminal** - QR Code no terminal
- **Chalk** - estilização do CLI
- **Winston** - sistema de logs

## 📦 Instalação

### Pré-requisitos

- Node.js v20 ou superior
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

3. **Inicie o servidor**
   ```bash
   npm start
   ```

4. Na primeira inicialização, os arquivos `config/devices.json` e `config/server.json` serão criados automaticamente.

5. **Configure os dispositivos**
   - Após iniciar, use o comando `device-add` no terminal para adicionar seus dispositivos de forma interativa.
   - Repita o processo para todos os dispositivos que deseja monitorar.

6. **Configure o WhatsApp**
   - Use `wa-connect` para escanear o QR Code.
   - Use `wa-groups` para listar seus grupos.
   - Use `wa-set` para definir o grupo de notificações.
   - Use `wa-test` para enviar uma mensagem de teste.

## ⚙️ Configuração

### Arquivo config/devices.json

Este arquivo armazena os dispositivos a serem monitorados. É recomendado gerenciá-lo através dos comandos `device-add`, `device-edit` e `device-remove`.

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

### Arquivo config/server.json

Controla as configurações do servidor web. Gerencie através dos comandos `config-show` e `config-set`.

```json
{
  "host": "0.0.0.0",
  "port": 80
}
```

- **host**: Endereço de IP para o bind do servidor. `0.0.0.0` permite acesso de outras máquinas na rede.
- **port**: Porta em que o servidor web e WebSocket irão rodar.

**Importante**: Alterações neste arquivo exigem uma reinicialização do servidor para terem efeito.

## 🚀 Uso

### Interface web

Acesse a interface web usando o IP do seu servidor e a porta configurada (ex: `http://localhost:80/`):

### CLI

O CLI é ativado automaticamente ao iniciar o servidor. 

## 📊 Monitoramento e logs

O sistema gera dois tipos de logs na pasta `logs/`:

- `netview.log`: Log geral de operações do servidor, erros e informações.
- `history.jsonl`: Log estruturado contendo apenas as mudanças de status (Online/Offline) dos dispositivos, usado pelo comando `device-history`.

Use `logs-toggle` no CLI para ver logs em tempo real ou `logs` para ver as últimas entradas do `netview.log`.

## 🐛 Solução de problemas

### WhatsApp não conecta

- Se a autenticação falhar repetidamente, use o comando `wa-reset` no CLI. Ele limpará a sessão salva.
- Após o reset, use `wa-connect` para conectar novamente.

### Interface web não carrega

- Verifique se o servidor está rodando e em qual porta com o comando `config-show`.
- Verifique os logs com o comando `logs` no CLI para ver se há erros na inicialização.

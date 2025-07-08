# NetView - Monitoramento de rede

NetView é um sistema simples para monitorar dispositivos da rede via ping. Interface web limpa, alertas por WhatsApp, CLI interativo e suporte a modo background pra rodar com PM2 ou similares.

![Preview do NetView](https://i.imgur.com/BsXJeVb.png)

---

## O que ele faz

- **Monitoramento em tempo real**
  - Verifica status (online/offline/fora de horário) dos dispositivos com base no ping.
  - Suporte a horários de funcionamento por dispositivo.

- **Interface web**
  - Dashboard com filtros por status e categoria.
  - Tempo de resposta e última verificação.

- **Notificações por WhatsApp**
  - Alertas de mudança de status direto no grupo que você escolher.
  - Conexão via QR Code, simples e rápido.

- **CLI interativo**
  - Adiciona e gerencia dispositivos.
  - Edita as configurações do servidor.
  - Conecta e gerencia o WhatsApp.
  - Mostra histórico e logs em tempo real.

- **Arquitetura modular**
  - Backend com Express + WebSocket
  - Frontend com Vue.js
  - CLI embutido
  - Sistema de logs estruturado

---

## Tecnologias principais

- **Backend:** Node.js, Express, WebSocket  
- **Frontend:** Vue.js  
- **Notificações:** whatsapp-web.js, Puppeteer  
- **CLI:** Chalk  
- **Logs:** Winston  

---

## Instalação e uso

### Pré-requisitos

- Node.js v20+
- npm ou yarn
- WhatsApp instalado no celular

### 1. Clonar e instalar

```bash
git clone https://github.com/vtrcav/netview.git
cd netview
npm install
```

### 2. Modos de execução

#### Modo CLI (configuração e uso interativo)

```bash
npm start
# ou
node server.js --cli
```

> Esse é o modo completo: ativa a interface web, inicia o monitoramento e abre o CLI com comandos interativos.

#### Modo background (uso com PM2 ou scripts)

```bash
node server.js
```

> Esse modo roda em segundo plano e **não tem CLI**. Ideal pra deixar o serviço ativo 24/7.  
Antes de usar esse modo, configure tudo antes pelo CLI:  
adicione os dispositivos, conecte o WhatsApp e defina o grupo de alertas.

---

## Configuração

### `config/devices.json`

Arquivo com os dispositivos monitorados. Exemplo:

```json
"roteador-principal": {
  "ip": "192.168.0.1",
  "category": "infra",
  "description": "Roteador da recepção",
  "icon": "icone-opcional",
  "24h": true,
  "workingHours": {
    "weekday": { "start": 8, "end": 18 },
    "weekend": { "start": 0, "end": 0 }
  }
}
```

Use `device-add`, `device-edit`, `device-remove` pra gerenciar.

---

### `config/server.json`

Define porta e IP do servidor:

```json
{
  "host": "0.0.0.0",
  "port": 80
}
```

Use `config-show` e `config-set` no CLI pra editar sem abrir o arquivo.

> Mudanças nesse arquivo só valem após reiniciar o servidor.

---

## Web + CLI

### Interface web

Depois de iniciar o servidor, acesse no navegador:
```
http://localhost:80/
```
Ou substitua `localhost` pelo IP da máquina na rede.

### CLI (quando em modo `--cli`)

Alguns comandos úteis:

```bash
device-add            # Adiciona um dispositivo
device-history        # Mostra o histórico
config-show           # Exibe as configs atuais
wa-connect            # Escaneia QR Code do WhatsApp
wa-set                # Define grupo pra receber alertas
logs                  # Mostra últimas linhas do log
logs-toggle           # Liga/desliga log em tempo real
```

---

## Logs e histórico

- `logs/netview.log`: atividades gerais do sistema
- `logs/history.jsonl`: histórico de status (usado pelo comando `device-history`)

---

## Solução de problemas

### WhatsApp não conecta?

```bash
wa-reset   # limpa sessão salva
wa-connect # escaneia novamente
```

### Interface web não carrega?

- Verifique se o servidor está rodando
- Confirme host/porta com `config-show`
- Veja logs com `logs` no CLI
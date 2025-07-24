```markdown
# Diagrama de Arquitetura do NetView: Fluxo dos Módulos Principais

```mermaid
graph TD
    subgraph Backend (Servidor Node.js)
        NV[NetViewServer] --> CM[ConfigManager]: Carrega Config.
        NV --> PS[PingService]: Inicia Verificações
        NV --> DSM[DeviceStateManager]: Gerencia Estados
        NV --> NM[NotificationManager]: Gerencia Notificações
        NV --> WSH[WebSocketHandler]: Gerencia Conexões WS
        NV --> TM[TimerManager]: Agenda Tarefas
        NV --> CLIM[CliManager]: Interage com CLI
    end

    subgraph Frontend (Interface Web)
        WEB[Interface Web (Vue.js)]
    end

    subgraph Serviços Externos
        WA[WhatsApp API]
        FS[Sistema de Arquivos]
    end

    CM --> FS: Lê/Escreve devices.json
    PS --> DSM: Envia Resultados Ping
    PS --> FS: (Logs de Ping)
    DSM --> NM: Notifica Mudanças Status
    DSM --> WSH: Envia Atualizações Status
    DSM --> FS: Registra Histórico (history.jsonl)

    NM --> WAC[WhatsAppClient]: Solicita Envio Msg
    WAC --> WA: Envia Mensagens
    WAC --> FS: Salva/Lê sessão WA

    WSH -- WebSocket --> WEB: Atualizações em Tempo Real
    WEB -- WebSocket --> WSH: Comandos (e.g., manual_check)
    WEB -- HTTP --> NV: Carrega Assets/Config

    CLIM -- Interação --> NV: Comandos CLI
    CLIM --> FS: Gerencia Configs/Logs

    TM --> CM: Dispara checkConfigUpdates
    TM --> PS: Dispara checkAllDevices

    style NV fill:#f9f,stroke:#333,stroke-width:2px
    style WEB fill:#bbf,stroke:#333,stroke-width:2px
    style WA fill:#afa,stroke:#333,stroke-width:2px
    style FS fill:#ffc,stroke:#333,stroke-width:2px
```

---

### Explicação do Fluxo:

1.  **`NetViewServer` (NV):** É o orquestrador central. Ele inicializa todos os outros módulos e coordena suas interações.
2.  **`ConfigManager` (CM):** Carrega as configurações dos dispositivos (`devices.json`) do `Sistema de Arquivos` (FS) para o `NetViewServer`. Também monitora o arquivo para recarregar as configurações em caso de alterações.
3.  **`TimerManager` (TM):** Agenda tarefas periódicas para o `NetViewServer`, como:
    *   Disparar o `ConfigManager` para verificar atualizações de configuração.
    *   Disparar o `PingService` para verificar todos os dispositivos.
4.  **`PingService` (PS):** Realiza pings nos dispositivos configurados. Os resultados do ping são enviados para o `DeviceStateManager`.
5.  **`DeviceStateManager` (DSM):** Recebe os resultados do `PingService`, atualiza o estado dos dispositivos no `NetViewServer`, registra o histórico de status no `Sistema de Arquivos` (FS) e notifica o `NotificationManager` e o `WebSocketHandler` sobre quaisquer mudanças de status.
6.  **`NotificationManager` (NM):** Decide quando enviar notificações com base nas mudanças de status do `DeviceStateManager`. Ele solicita ao `WhatsAppClient` para enviar as mensagens.
7.  **`WhatsAppClient` (WAC):** Gerencia a conexão com a `WhatsApp API` e é responsável por enviar as mensagens de notificação. Ele também salva e carrega informações de sessão do WhatsApp no `Sistema de Arquivos` (FS).
8.  **`WebSocketHandler` (WSH):** Gerencia a comunicação em tempo real com a `Interface Web` (WEB).
    *   Envia atualizações de status e estatísticas para a `Interface Web`.
    *   Recebe comandos da `Interface Web` (como solicitações de verificação manual).
9.  **`CliManager` (CLIM):** Fornece a interface de linha de comando interativa. Ele interage diretamente com o `NetViewServer` para executar comandos de gerenciamento (WhatsApp, dispositivos, configurações) e também acessa o `Sistema de Arquivos` (FS) para gerenciar configurações e logs.
10. **`Interface Web` (WEB):** O dashboard acessado pelo navegador.
    *   Carrega seus assets e configurações via `HTTP` do `NetViewServer`.
    *   Mantém uma conexão `WebSocket` com o `WebSocketHandler` para receber atualizações em tempo real e enviar comandos.

Este diagrama ilustra como os diferentes componentes do NetView trabalham juntos para fornecer o monitoramento de rede e as funcionalidades de notificação.

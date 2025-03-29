const app = new Vue({
    el: '#app',
    data: {
      devices: [],
      deviceGroups: {},
      stats: {
        total: 0,
        online: 0,
        offline: 0,
        outOfHours: 0,
        checkDuration: 'Real-time'
      },
      lastUpdate: null,
      connectionStatus: 'Conectando...',
      websocket: null,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
      reconnectDelay: 3000,
      loading: true,
      error: null,
      showModal: false,
      showConfigModal: false,
      filter: {
        status: 'all',
        search: '',
        category: 'all'
      },
      config: {
        showNotifications: true
      },
      // Nova propriedade para a ordem das categorias
      categoryOrder: [
        'Servidores',
        'Sistemas',
        'Roteadores',
        'Impressoras',
        'Câmeras'
      ]
    },
    created() {
      this.loadUserConfig();
      this.connectWebSocket();
      window.addEventListener('online', this.handleConnectionChange);
      window.addEventListener('offline', this.handleConnectionChange);
    },
    beforeDestroy() {
      window.removeEventListener('online', this.handleConnectionChange);
      window.removeEventListener('offline', this.handleConnectionChange);
      if (this.websocket) {
        this.websocket.close();
      }
    },
    computed: {
        filteredDevices() {
            let filtered = [];
            
            // Primeiro filtra os dispositivos normalmente
            Object.keys(this.deviceGroups).forEach(groupName => {
              this.deviceGroups[groupName].forEach(device => {
                if (this.filter.status !== 'all' && device.status !== this.filter.status) return;
                if (this.filter.category !== 'all' && device.category !== this.filter.category) return;
                if (this.filter.search && 
                    !device.name.toLowerCase().includes(this.filter.search.toLowerCase()) &&
                    !device.ip.toLowerCase().includes(this.filter.search.toLowerCase())) return;
                filtered.push(device);
              });
            });
            
            // Ordena os dispositivos filtrados por:
            // 1. Status (Offline primeiro, Fora de horário por último)
            // 2. Categoria (seguindo categoryOrder)
            // 3. Nome (ordem alfabética)
            return filtered.sort((a, b) => {
              // Primeiro critério: status
              // Prioridades: 1. Offline, 2. Online, 3. Fora de horário
              
              // Se um é "Fora de horário" e o outro não, o "Fora de horário" vai para o final
              if (a.status === 'Fora de horário' && b.status !== 'Fora de horário') return 1;
              if (a.status !== 'Fora de horário' && b.status === 'Fora de horário') return -1;
              
              // Se nenhum é "Fora de horário" ou ambos são, seguimos com a regra de Offline primeiro
              if (a.status === 'Offline' && b.status !== 'Offline') return -1;
              if (a.status !== 'Offline' && b.status === 'Offline') return 1;
              
              // Segundo critério: categoria conforme categoryOrder
              const categoryA = a.category || 'Outros';
              const categoryB = b.category || 'Outros';
              
              const indexA = this.categoryOrder.indexOf(categoryA);
              const indexB = this.categoryOrder.indexOf(categoryB);
              
              // Se a categoria não estiver na lista de ordem, coloca no final
              const orderA = indexA !== -1 ? indexA : this.categoryOrder.length;
              const orderB = indexB !== -1 ? indexB : this.categoryOrder.length;
              
              if (orderA !== orderB) return orderA - orderB;
              
              // Terceiro critério: ordem alfabética por nome
              return a.name.localeCompare(b.name);
            });
        },
      categories() {
        const allCategories = Object.keys(this.deviceGroups || {});
        
        // Ordena as categorias de acordo com a ordem definida
        return allCategories.sort((a, b) => {
          const indexA = this.categoryOrder.indexOf(a);
          const indexB = this.categoryOrder.indexOf(b);
          
          // Se a categoria não estiver na lista de ordem, coloca no final
          const orderA = indexA !== -1 ? indexA : this.categoryOrder.length;
          const orderB = indexB !== -1 ? indexB : this.categoryOrder.length;
          
          return orderA - orderB;
        });
      },
      connectionClass() {
        return {
          'connection-online': this.connectionStatus === 'Conectado',
          'connection-reconnecting': this.connectionStatus === 'Reconectando...',
          'connection-offline': this.connectionStatus !== 'Conectado' && this.connectionStatus !== 'Reconectando...'
        };
      }
    },
    methods: {
      blinkClass(status) {
        return status === 'Offline' ? 'blink' : '';
      },
      handleConnectionChange(event) {
        if (navigator.onLine) {
          this.connectWebSocket();
        } else {
          this.connectionStatus = 'Offline (navegador)';
          this.error = 'Sem conexão com a internet.';
        }
      },
      connectWebSocket() {
        if (this.websocket) {
          this.websocket.close();
        }
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.hostname || 'monitoramento.hnr.ma';
        const wsPort = 8080;
        const wsUrl = `${protocol}//${wsHost}:${wsPort}`;
        console.log('Conectando ao WebSocket:', wsUrl);
        
        this.connectionStatus = 'Conectando...';
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = this.handleWebSocketOpen;
        this.websocket.onmessage = this.handleWebSocketMessage;
        this.websocket.onclose = this.handleWebSocketClose;
        this.websocket.onerror = this.handleWebSocketError;
      },
      handleWebSocketOpen() {
        console.log('Conexão WebSocket estabelecida');
        this.connectionStatus = 'Conectado';
        this.error = null;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 3000;
        this.sendWebSocketMessage({ type: 'get_config' });
      },
      handleWebSocketMessage(event) {
        try {
          // Suporte para múltiplas mensagens em uma única transmissão
          const messages = event.data.split('\n').map(msg => JSON.parse(msg));
          messages.forEach(data => {
            console.log('Mensagem recebida:', data);
            
            switch (data.type) {
              case 'status_update':
                this.processInitialState(data.groups);
                this.stats = { ...this.stats, ...data.stats };
                this.loading = false;
                this.lastUpdate = new Date().toLocaleString();
                break;
              case 'device_update':
                this.updateDevice(data.device);
                this.lastUpdate = new Date().toLocaleString();
                if (this.config.showNotifications && data.device.status === 'Offline') {
                  this.notifyOfflineDevice(data.device);
                }
                break;
              case 'config_data':
                console.log('Configuração recebida:', data.config);
                this.loading = false;
                break;
              case 'error':
                console.error('Erro do servidor:', data.message);
                this.error = data.message;
                break;
            }
          });
        } catch (error) {
          console.error('Erro ao processar mensagem:', error);
        }
      },
      processInitialState(groups) {
        this.deviceGroups = groups; // Diretamente usa os grupos enviados pelo servidor
        this.updateDevicesArray();
        this.updateStats();
      },
      updateDevice(device) {
        const category = device.category || 'Outros';
        if (!this.deviceGroups[category]) {
          this.$set(this.deviceGroups, category, []);
        }
        
        const index = this.deviceGroups[category].findIndex(d => d.name === device.name);
        if (index >= 0) {
          this.$set(this.deviceGroups[category], index, device);
        } else {
          this.deviceGroups[category].push(device);
        }
        
        this.updateDevicesArray();
        this.updateStats();
      },
      updateDevicesArray() {
        this.devices = Object.values(this.deviceGroups).flat();
      },
      updateStats() {
        this.stats.total = this.devices.length;
        this.stats.online = this.devices.filter(d => d.status === 'Online').length;
        this.stats.offline = this.devices.filter(d => d.status === 'Offline').length;
        this.stats.outOfHours = this.devices.filter(d => d.status === 'Fora de horário').length;
      },
      notifyOfflineDevice(device) {
        if (Notification && Notification.permission === 'granted') {
          new Notification('NetView - Dispositivo Offline', {
            body: `${device.name} (${device.ip}) está offline!`,
            icon: 'assets/img/favicon.png'
          });
        } else if (Notification && Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      },
      handleWebSocketClose() {
        if (this.connectionStatus !== 'Offline (navegador)') {
          this.connectionStatus = 'Desconectado';
          this.attemptReconnect();
        }
      },
      handleWebSocketError(event) {
        console.error('Erro WebSocket:', event);
        this.error = 'Erro na conexão com o servidor';
      },
      attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          this.connectionStatus = `Reconectando... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
          setTimeout(() => this.connectWebSocket(), this.reconnectDelay);
          this.reconnectDelay = Math.min(30000, this.reconnectDelay * 1.5);
        } else {
          this.connectionStatus = 'Falha na conexão';
          this.error = 'Não foi possível conectar após várias tentativas.';
        }
      },
      sendWebSocketMessage(message) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send(JSON.stringify(message));
        }
      },
      loadUserConfig() {
        const savedConfig = localStorage.getItem('netviewConfig');
        if (savedConfig) {
          this.config = JSON.parse(savedConfig);
        }
      },
      saveUserConfig() {
        localStorage.setItem('netviewConfig', JSON.stringify(this.config));
        this.showConfigModal = false;
      },
      manualUpdate() {
        this.sendWebSocketMessage({ type: 'manual_check' });
      },
      checkDevice(deviceName) {
        this.sendWebSocketMessage({ 
          type: 'check_device', 
          device: deviceName 
        });
      },
      formatResponseTime(time) {
        return time === null ? 'N/A' : time.toFixed(1) + ' ms';
      },
      openConfig() {
        this.showConfigModal = true;
      }
    }
  });
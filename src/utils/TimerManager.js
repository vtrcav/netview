const logger = require('../utils/Logger');
class TimerManager {
    constructor(server) {
        this.server = server;
    }
    setupTimers() {
        logger.info("Configurando timers...");
        for (const key in this.server.timers) {
            clearInterval(this.server.timers[key]);
        }
        this.server.timers = {};
        this.server.timers['config'] = setInterval(() => {
            this.server.configManager.checkConfigUpdates();
        }, this.server.configWatchInterval * 1000);
        this.server.timers['devices'] = setInterval(() => {
            this.server.pingService.checkAllDevices();
        }, this.server.pingInterval * 1000);
        logger.info(`Timers configurados - Ping: ${this.server.pingInterval}s, Config Watch: ${this.server.configWatchInterval}s`);
    }
}
module.exports = { TimerManager };
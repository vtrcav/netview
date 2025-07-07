const fs = require('fs');
const path = require('path');
async function logStatusChange(deviceName, status) {
    const logDir = path.resolve(__dirname, '../../logs');
    const logFile = path.join(logDir, 'history.jsonl');
    const event = {
        timestamp: new Date().toISOString(),
        device: deviceName,
        status: status
    };
    try {
        if (!fs.existsSync(logDir)) {
            await fs.promises.mkdir(logDir, { recursive: true });
        }
        await fs.promises.appendFile(logFile, JSON.stringify(event) + '\n');
    } catch (error) {
        logger.error(`[HistoryLogger] Falha ao registrar evento: ${error.message}`);
    }
}
module.exports = { logStatusChange };
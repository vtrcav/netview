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
        await checkAndRotateHistory(logFile);
        await fs.promises.appendFile(logFile, JSON.stringify(event) + '\n');
    } catch (error) {
        console.error(`[HistoryLogger] Falha ao registrar evento: ${error.message}`);
    }
}
async function checkAndRotateHistory(logFile) {
    try {
        if (fs.existsSync(logFile)) {
            const stats = fs.statSync(logFile);
            const fileSizeInMB = stats.size / (1024 * 1024);
            if (fileSizeInMB > 2) {
                const backupPath = `${logFile}.${Date.now()}`;
                await fs.promises.rename(logFile, backupPath);
                await cleanOldHistoryLogs(path.dirname(logFile));
            }
        }
    } catch (error) {
        console.error(`[HistoryLogger] Erro ao verificar rotação: ${error.message}`);
    }
}
async function cleanOldHistoryLogs(logsDir) {
    try {
        const files = fs.readdirSync(logsDir)
            .filter(file => file.startsWith('history.jsonl.') && file.match(/\d+$/))
            .sort((a, b) => {
                const aTime = parseInt(a.split('.').pop());
                const bTime = parseInt(b.split('.').pop());
                return bTime - aTime;
            });
        for (const file of files.slice(3)) {
            await fs.promises.unlink(path.join(logsDir, file));
        }
    } catch (error) {
        console.error(`[HistoryLogger] Erro ao limpar logs antigos: ${error.message}`);
    }
}
module.exports = { logStatusChange };
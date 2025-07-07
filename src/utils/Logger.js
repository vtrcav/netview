const winston = require('winston');
const path = require('path');
const EventEmitter = require('events');
const fs = require('fs');
class Logger extends EventEmitter {
    constructor() {
        super();
        const logPath = path.join(__dirname, '../../logs/netview.log');
        this.checkAndRotateLog(logPath);
        this.winstonLogger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
                })
            ),
            transports: [
                new winston.transports.File({ 
                    filename: logPath,
                    maxsize: 10 * 1024 * 1024,
                    maxFiles: 3,
                    tailable: true
                }),
                new winston.transports.Stream({ stream: this.createLogStream() })
            ]
        });
    }
    checkAndRotateLog(logPath) {
        try {
            if (fs.existsSync(logPath)) {
                const stats = fs.statSync(logPath);
                const fileSizeInMB = stats.size / (1024 * 1024);
                if (fileSizeInMB > 10) {
                    const backupPath = `${logPath}.${Date.now()}`;
                    fs.renameSync(logPath, backupPath);
                    this.cleanOldLogs(path.dirname(logPath));
                }
            }
        } catch (error) {
            console.error('Erro ao verificar log:', error);
        }
    }
    cleanOldLogs(logsDir) {
        try {
            const files = fs.readdirSync(logsDir)
                .filter(file => file.startsWith('netview.log.') && file.match(/\d+$/))
                .sort((a, b) => {
                    const aTime = parseInt(a.split('.').pop());
                    const bTime = parseInt(b.split('.').pop());
                    return bTime - aTime;
                });
            files.slice(3).forEach(file => {
                fs.unlinkSync(path.join(logsDir, file));
            });
        } catch (error) {
            console.error('Erro ao limpar logs antigos:', error);
        }
    }
    createLogStream() {
        const stream = new (require('stream').Writable)();
        stream._write = (chunk, encoding, callback) => {
            this.emit('log', chunk.toString().trim());
            callback();
        };
        return stream;
    }
    info(message) {
        this.winstonLogger.info(message);
    }
    error(message) {
        this.winstonLogger.error(message);
    }
    warn(message) {
        this.winstonLogger.warn(message);
    }
    debug(message) {
        this.winstonLogger.debug(message);
    }
}
const logger = new Logger();
module.exports = logger;
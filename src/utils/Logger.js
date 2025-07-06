const winston = require('winston');
const path = require('path');
const EventEmitter = require('events');
class Logger extends EventEmitter {
    constructor() {
        super();
        this.winstonLogger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
                })
            ),
            transports: [
                new winston.transports.File({ filename: path.join(__dirname, '../../logs/netview.log') }),
                new winston.transports.Stream({ stream: this.createLogStream() })
            ]
        });
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
}
const logger = new Logger();
module.exports = logger;

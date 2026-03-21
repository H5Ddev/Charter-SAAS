import winston from 'winston'

const isDevelopment = process.env.NODE_ENV !== 'production'
const logLevel = process.env.LOG_LEVEL || 'info'

const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : ''
    return `${timestamp} [${level}]: ${message}${metaStr}`
  }),
)

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
)

export const logger = winston.createLogger({
  level: logLevel === 'silent' ? 'silent' : logLevel,
  format: isDevelopment ? developmentFormat : productionFormat,
  defaultMeta: { service: 'aerocomm-backend' },
  transports: [
    new winston.transports.Console({
      silent: logLevel === 'silent',
    }),
  ],
})

// Stream for morgan integration
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim())
  },
}

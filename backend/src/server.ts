import './config/env' // Validate env vars first
import { PrismaClient } from '@prisma/client'
import { httpServer } from './app'
import { initAzureClients, closeServiceBusClient } from './config/azure'
import { logger } from './shared/utils/logger'
import { env } from './config/env'

// ─────────────────────────────────────────────────────────────────────────────
// Prisma Client (singleton)
// ─────────────────────────────────────────────────────────────────────────────

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development'
    ? [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ]
    : [
        { emit: 'event', level: 'error' },
      ],
})

if (env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug(`Prisma query: ${e.query}`, { params: e.params, duration: e.duration })
  })
}

prisma.$on('error', (e) => {
  logger.error('Prisma error:', e)
})

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  try {
    // 1. Connect to database
    await prisma.$connect()
    logger.info('Database connected successfully')

    // 2. Initialise Azure clients
    await initAzureClients()

    // 3. Start Service Bus consumers (lazy — only if configured)
    if (env.AZURE_SERVICE_BUS_CONNECTION_STRING) {
      const { AutomationEngineConsumer } = await import('./modules/automation/engine.consumer')
      const consumer = new AutomationEngineConsumer()
      consumer.start()
    } else {
      logger.warn('Service Bus not configured — automation engine consumer not started')
    }

    // 4. Start HTTP server
    const port = env.PORT
    httpServer.listen(port, () => {
      logger.info(`AeroComm API started`, {
        port,
        environment: env.NODE_ENV,
        docs: `${env.API_BASE_URL}/api/docs`,
      })
    })
  } catch (err) {
    logger.error('Failed to start server:', err)
    process.exit(1)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Graceful Shutdown
// ─────────────────────────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal} — shutting down gracefully`)

  // Stop accepting new connections
  httpServer.close(async () => {
    logger.info('HTTP server closed')

    try {
      await closeServiceBusClient()
      await prisma.$disconnect()
      logger.info('Graceful shutdown complete')
      process.exit(0)
    } catch (err) {
      logger.error('Error during shutdown:', err)
      process.exit(1)
    }
  })

  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 30_000)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason)
})

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err)
  void shutdown('uncaughtException')
})

void bootstrap()

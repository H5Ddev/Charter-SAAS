import './config/env' // Validate env vars first
import { PrismaClient } from '@prisma/client'
import { httpServer } from './app'
import { initAzureClients } from './config/azure'
import { getBoss, stopBoss } from './shared/queue/boss'
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

    // 2. Start pg-boss queue (creates pgboss schema on first run)
    await getBoss()

    // 3. Start automation engine worker
    const { AutomationEngineConsumer } = await import('./modules/automation/engine.consumer')
    const consumer = new AutomationEngineConsumer()
    await consumer.start()

    // 4. Initialise optional Azure clients (Key Vault, Blob Storage)
    await initAzureClients()

    // 5. Start HTTP server
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

  httpServer.close(async () => {
    logger.info('HTTP server closed')

    try {
      await stopBoss()
      await prisma.$disconnect()
      logger.info('Graceful shutdown complete')
      process.exit(0)
    } catch (err) {
      logger.error('Error during shutdown:', err)
      process.exit(1)
    }
  })

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

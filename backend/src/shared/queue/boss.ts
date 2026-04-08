import PgBoss from 'pg-boss'
import { env } from '../../config/env'
import { logger } from '../utils/logger'

let boss: PgBoss | null = null

export async function getBoss(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss({
      connectionString: env.DATABASE_URL,
      // Keep job history for 3 days
      deleteAfterDays: 3,
      // Retry failed jobs up to 10 times with exponential backoff
      retryLimit: 10,
      retryDelay: 30,
      retryBackoff: true,
    })

    boss.on('error', (err) => {
      logger.error('pg-boss error', { error: err.message })
    })

    await boss.start()
    logger.info('pg-boss queue started')
  }

  return boss
}

export async function stopBoss(): Promise<void> {
  if (boss) {
    await boss.stop()
    boss = null
    logger.info('pg-boss queue stopped')
  }
}

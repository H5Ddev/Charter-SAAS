/**
 * Backfill null tenantId values on child tables from their parent's tenantId.
 *
 * Must run BEFORE `prisma db push` promotes these columns to NOT NULL,
 * otherwise the NOT NULL constraint will fail on existing null rows.
 *
 * Idempotent: only updates rows where tenantId IS NULL.
 *
 * Run:
 *   DATABASE_URL="..." npx ts-node --transpile-only scripts/backfill-tenantid-nulls.ts
 */

import { PrismaClient } from '@prisma/client'

async function main(): Promise<void> {
  const prisma = new PrismaClient()

  try {
    const backfills = [
      {
        label: 'user_mfa_settings',
        sql: `UPDATE [dbo].[user_mfa_settings]
              SET [tenantId] = u.[tenantId]
              FROM [dbo].[user_mfa_settings] mfa
              INNER JOIN [dbo].[users] u ON u.[id] = mfa.[userId]
              WHERE mfa.[tenantId] IS NULL`,
      },
      {
        label: 'automation_triggers',
        sql: `UPDATE [dbo].[automation_triggers]
              SET [tenantId] = a.[tenantId]
              FROM [dbo].[automation_triggers] t
              INNER JOIN [dbo].[automations] a ON a.[id] = t.[automationId]
              WHERE t.[tenantId] IS NULL`,
      },
      {
        label: 'automation_condition_groups',
        sql: `UPDATE [dbo].[automation_condition_groups]
              SET [tenantId] = a.[tenantId]
              FROM [dbo].[automation_condition_groups] cg
              INNER JOIN [dbo].[automations] a ON a.[id] = cg.[automationId]
              WHERE cg.[tenantId] IS NULL`,
      },
      {
        label: 'automation_conditions',
        sql: `UPDATE [dbo].[automation_conditions]
              SET [tenantId] = cg.[tenantId]
              FROM [dbo].[automation_conditions] c
              INNER JOIN [dbo].[automation_condition_groups] cg ON cg.[id] = c.[conditionGroupId]
              WHERE c.[tenantId] IS NULL`,
      },
      {
        label: 'automation_actions',
        sql: `UPDATE [dbo].[automation_actions]
              SET [tenantId] = a.[tenantId]
              FROM [dbo].[automation_actions] act
              INNER JOIN [dbo].[automations] a ON a.[id] = act.[automationId]
              WHERE act.[tenantId] IS NULL`,
      },
    ]

    for (const b of backfills) {
      const updated = await prisma.$executeRawUnsafe(b.sql)
      console.log(`[backfill] ${b.label.padEnd(32)} updated=${updated}`)
    }

    // Verify: count remaining nulls
    const checks = [
      { label: 'user_mfa_settings',           sql: `SELECT COUNT(*) AS n FROM [dbo].[user_mfa_settings] WHERE [tenantId] IS NULL` },
      { label: 'automation_triggers',          sql: `SELECT COUNT(*) AS n FROM [dbo].[automation_triggers] WHERE [tenantId] IS NULL` },
      { label: 'automation_condition_groups',   sql: `SELECT COUNT(*) AS n FROM [dbo].[automation_condition_groups] WHERE [tenantId] IS NULL` },
      { label: 'automation_conditions',         sql: `SELECT COUNT(*) AS n FROM [dbo].[automation_conditions] WHERE [tenantId] IS NULL` },
      { label: 'automation_actions',            sql: `SELECT COUNT(*) AS n FROM [dbo].[automation_actions] WHERE [tenantId] IS NULL` },
    ]

    let totalNulls = 0
    for (const c of checks) {
      const result = await prisma.$queryRawUnsafe<Array<{ n: number | bigint }>>(c.sql)
      const n = Number(result[0]?.n ?? 0)
      totalNulls += n
      if (n > 0) console.warn(`[backfill] WARN: ${c.label} still has ${n} null tenantId rows`)
    }

    if (totalNulls > 0) {
      console.error(`[backfill] FAIL: ${totalNulls} rows still have null tenantId — NOT NULL promotion will fail`)
      process.exit(1)
    }

    console.log('[backfill] ✅ all tenantId nulls resolved — safe to promote to NOT NULL')
    process.exit(0)
  } catch (err) {
    console.error('[backfill] FAILED:', err instanceof Error ? err.message : err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

void main()

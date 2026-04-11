/**
 * Backfill airport FK columns from legacy ICAO strings.
 *
 * Idempotent: uses WHERE airportId IS NULL so re-runs only touch new orphans.
 *
 * Safety guard: aborts if airports table has < MIN_AIRPORTS rows, since an
 * empty/under-seeded airports table would silently null every row.
 *
 * Exit codes:
 *   0 — success, all rows with a valid ICAO now have their FK set
 *   1 — safety guard failed or backfill hit an error
 *   2 — backfill succeeded but some rows still have NULL FKs because their
 *       ICAO doesn't match any row in the airports table (these must be
 *       fixed by hand before the eventual NOT NULL promotion in phase 2)
 *
 * Run locally:
 *   DATABASE_URL="..." npx ts-node --transpile-only scripts/backfill-airport-fks.ts
 *
 * Run in CI: added as a step in db-migrate.yml after `prisma db push`.
 */

import { PrismaClient } from '@prisma/client'

const MIN_AIRPORTS = 5000

interface BackfillTarget {
  label: string
  table: string
  fkColumn: string
  icaoColumn: string
  allowNull: boolean // true if the ICAO column itself is nullable
}

const TARGETS: BackfillTarget[] = [
  { label: 'aircraft.homeBase',       table: 'aircraft', fkColumn: 'homeBaseAirportId',    icaoColumn: 'homeBaseIcao',    allowNull: true  },
  { label: 'trip.origin',             table: 'trips',    fkColumn: 'originAirportId',      icaoColumn: 'originIcao',      allowNull: false },
  { label: 'trip.destination',        table: 'trips',    fkColumn: 'destinationAirportId', icaoColumn: 'destinationIcao', allowNull: false },
  { label: 'quote.origin',            table: 'quotes',   fkColumn: 'originAirportId',      icaoColumn: 'originIcao',      allowNull: true  },
  { label: 'quote.destination',       table: 'quotes',   fkColumn: 'destinationAirportId', icaoColumn: 'destinationIcao', allowNull: true  },
]

async function main(): Promise<void> {
  const prisma = new PrismaClient()

  try {
    // ── Safety guard ───────────────────────────────────────────────────────
    const airports = await prisma.airport.count()
    console.log(`[backfill] airports table has ${airports} rows`)
    if (airports < MIN_AIRPORTS) {
      console.error(`[backfill] ABORT: airports table has < ${MIN_AIRPORTS} rows (${airports}).`)
      console.error(`[backfill] Run scripts/seed-airports.ts first to populate the reference data.`)
      process.exit(1)
    }

    // ── Backfill each target ───────────────────────────────────────────────
    let unresolvedTotal = 0
    const report: Array<{ target: string; updated: number; unresolved: number }> = []

    for (const t of TARGETS) {
      // Update: for rows where the FK is still NULL and the ICAO matches an airport,
      // set the FK to the airport's id.
      // Use [dbo].[table] for SQL Server explicit schema. Prisma's $executeRawUnsafe
      // lets us interpolate the identifiers since they are code-controlled (not user input).
      const updateSql = `
        UPDATE [dbo].[${t.table}]
        SET [${t.fkColumn}] = a.[id]
        FROM [dbo].[${t.table}] t
        INNER JOIN [dbo].[airports] a ON a.[icaoCode] = t.[${t.icaoColumn}]
        WHERE t.[${t.fkColumn}] IS NULL
      `
      const updated = await prisma.$executeRawUnsafe(updateSql)

      // Count rows still unresolved: FK is null AND either the ICAO is present
      // (meaning it didn't match an airport) OR, for non-nullable ICAO columns,
      // we count every null FK.
      const unresolvedSql = t.allowNull
        ? `SELECT COUNT(*) AS n FROM [dbo].[${t.table}] WHERE [${t.fkColumn}] IS NULL AND [${t.icaoColumn}] IS NOT NULL AND (deletedAt IS NULL OR 1=1)`
        : `SELECT COUNT(*) AS n FROM [dbo].[${t.table}] WHERE [${t.fkColumn}] IS NULL AND (deletedAt IS NULL OR 1=1)`
      const unresolvedResult = await prisma.$queryRawUnsafe<Array<{ n: number | bigint }>>(unresolvedSql)
      const unresolved = Number(unresolvedResult[0]?.n ?? 0)

      unresolvedTotal += unresolved
      report.push({ target: t.label, updated, unresolved })
      console.log(`[backfill] ${t.label.padEnd(22)}  updated=${updated}  still_unresolved=${unresolved}`)
    }

    // ── Summary ────────────────────────────────────────────────────────────
    console.log('')
    console.log('[backfill] ─── summary ───')
    for (const r of report) {
      console.log(`[backfill]   ${r.target.padEnd(22)} updated=${r.updated} unresolved=${r.unresolved}`)
    }
    console.log(`[backfill] total unresolved rows: ${unresolvedTotal}`)

    if (unresolvedTotal > 0) {
      console.warn('')
      console.warn('[backfill] WARN: some rows still have NULL FKs because their ICAO')
      console.warn('[backfill] does not match any row in the airports table.')
      console.warn('[backfill] Investigate the offending rows and either fix the ICAO')
      console.warn('[backfill] or insert the missing airport before phase 2 (NOT NULL).')
      process.exit(2)
    }

    console.log('[backfill] ✅ all rows resolved cleanly')
    process.exit(0)
  } catch (err) {
    console.error('[backfill] FAILED:', err instanceof Error ? err.message : err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

void main()

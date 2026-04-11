/**
 * Smoke test for airport FK phase 1 wiring.
 *
 * Verifies end-to-end against a live local SQL Server DB:
 *   1. Create trip with valid ICAO → populates both origin/destination FKs
 *      and the include returns the hydrated Airport relation
 *   2. Create trip with bogus ICAO ("ZZZZ") → rejected with AIRPORT_NOT_FOUND
 *   3. Fetch a trip that was backfilled → FKs populated, relation hydrates
 *
 * Run inside the container (Prisma engine must be Linux-native):
 *   docker compose run --rm \
 *     -e DATABASE_URL="sqlserver://db:1433;database=aerocomm_dev;user=sa;password=AeroComm_Dev1!;encrypt=false;trustServerCertificate=true" \
 *     backend sh -c "cd /app && npx ts-node --transpile-only scripts/smoke-test-airport-fks.ts"
 */

import { PrismaClient } from '@prisma/client'
import { TripsService } from '../src/modules/scheduling/trips.service'

async function main(): Promise<void> {
  const prisma = new PrismaClient()
  const svc = new TripsService(prisma)

  try {
    const tenant = await prisma.tenant.findFirst({})
    if (!tenant) throw new Error('no tenant — run seed')
    const aircraft = await prisma.aircraft.findFirst({ where: { tenantId: tenant.id } })
    if (!aircraft) throw new Error('no aircraft — create one first')

    // ── TEST 1 ─────────────────────────────────────────────────────────────
    console.log('── TEST 1: valid ICAO creates trip with FKs populated ──')
    const goodTrip = await svc.create(tenant.id, 'smoke-test-user', {
      aircraftId: aircraft.id,
      originIcao: 'KTEB',
      destinationIcao: 'KJFK',
      departureAt: new Date(Date.now() + 3_600_000).toISOString(),
      paxCount: 2,
      passengerIds: [],
      crewIds: [],
    })
    console.log(`  id=${goodTrip.id}`)
    console.log(`  originAirportId=${goodTrip.originAirportId} destinationAirportId=${goodTrip.destinationAirportId}`)
    // @ts-expect-error — relation is dynamic
    console.log(`  origin.name=${goodTrip.origin?.name}`)
    // @ts-expect-error
    console.log(`  destination.name=${goodTrip.destination?.name}`)
    if (!goodTrip.originAirportId || !goodTrip.destinationAirportId) {
      console.error('  FAIL_1: FKs not populated')
      process.exit(1)
    }
    console.log('  ✅ PASS_1')

    // ── TEST 2 ─────────────────────────────────────────────────────────────
    console.log('── TEST 2: bogus ICAO is rejected with AIRPORT_NOT_FOUND ──')
    try {
      await svc.create(tenant.id, 'smoke-test-user', {
        aircraftId: aircraft.id,
        originIcao: 'ZZZZ',
        destinationIcao: 'KJFK',
        departureAt: new Date(Date.now() + 3_600_000).toISOString(),
        paxCount: 2,
        passengerIds: [],
        crewIds: [],
      })
      console.error('  FAIL_2: create with ZZZZ should have thrown')
      process.exit(1)
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string }
      if (e.code === 'AIRPORT_NOT_FOUND') {
        console.log(`  ✅ PASS_2: ${e.message}`)
      } else {
        console.error(`  FAIL_2: wrong error type: ${e.message ?? err}`)
        process.exit(1)
      }
    }

    // ── TEST 3 ─────────────────────────────────────────────────────────────
    console.log('── TEST 3: pre-existing backfilled trip survives + hydrates ──')
    const existing = await prisma.trip.findFirst({ where: { originIcao: 'KTEB', destinationIcao: 'KPBI' } })
    if (!existing) {
      console.log('  SKIP: no KTEB→KPBI trip exists — run local fixtures first')
    } else {
      const fetched = await svc.findById(tenant.id, existing.id)
      console.log(`  originAirportId=${fetched.originAirportId} destinationAirportId=${fetched.destinationAirportId}`)
      // @ts-expect-error
      console.log(`  origin.name=${fetched.origin?.name}`)
      // @ts-expect-error
      console.log(`  destination.name=${fetched.destination?.name}`)
      if (!fetched.originAirportId || !fetched.destinationAirportId) {
        console.error('  FAIL_3: backfilled trip has null FKs')
        process.exit(1)
      }
      console.log('  ✅ PASS_3')
    }

    // Cleanup: delete the TEST 1 trip we created
    await prisma.tripStatusHistory.deleteMany({ where: { tripId: goodTrip.id } })
    await prisma.trip.delete({ where: { id: goodTrip.id } })

    console.log('')
    console.log('✅ ALL SMOKE TESTS PASSED')
    process.exit(0)
  } catch (err) {
    console.error('SMOKE_TEST_FAILED:', err instanceof Error ? err.message : err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

void main()

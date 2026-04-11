import { PrismaClient } from '@prisma/client'
import { AppError } from '../middleware/errorHandler'

/**
 * Resolve an ICAO string to an airport.id (FK to the Airport reference table).
 *
 * - Returns null when `icao` is null/undefined/empty string (the caller decides
 *   whether null is acceptable for the target column).
 * - Throws 400 AIRPORT_NOT_FOUND when `icao` is provided but doesn't match any
 *   row in the airports table — this is the enforcement point that prevents
 *   orphan ICAO strings from being written for new records.
 *
 * ICAO codes are normalised to uppercase before lookup, matching how
 * seed-airports.ts inserts them.
 */
export async function resolveAirportId(
  prisma: PrismaClient,
  icao: string | null | undefined,
): Promise<number | null> {
  if (!icao) return null
  const code = icao.trim().toUpperCase()
  if (!code) return null

  const airport = await prisma.airport.findUnique({
    where: { icaoCode: code },
    select: { id: true },
  })

  if (!airport) {
    throw new AppError(400, 'AIRPORT_NOT_FOUND', `Airport not found for ICAO code: ${code}`)
  }

  return airport.id
}

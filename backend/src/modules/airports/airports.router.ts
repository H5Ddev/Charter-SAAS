import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../../shared/middleware/auth'
import { successResponse } from '../../shared/utils/response'

const prisma = new PrismaClient()

export const airportsRouter = Router()

/**
 * GET /api/airports/search?q=KTEB&limit=8
 * Search airports by ICAO code, IATA code, name, or city.
 * Returns airports sorted by name; ICAO prefix matches appear first due to index scan.
 */
airportsRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    const q = ((req.query.q as string) || '').trim()
    const limit = Math.min(parseInt((req.query.limit as string) || '8'), 20)

    if (q.length < 2) {
      return res.json(successResponse([]))
    }

    const airports = await prisma.airport.findMany({
      where: {
        OR: [
          { icaoCode: { startsWith: q.toUpperCase() } },
          { iataCode: { startsWith: q.toUpperCase() } },
          { name: { contains: q } },
          { municipality: { contains: q } },
        ],
      },
      orderBy: { name: 'asc' },
      take: limit,
      select: {
        icaoCode: true,
        iataCode: true,
        name: true,
        municipality: true,
        isoCountry: true,
        type: true,
        latitudeDeg: true,
        longitudeDeg: true,
      },
    })

    return res.json(successResponse(airports))
  } catch (err) {
    next(err)
  }
})

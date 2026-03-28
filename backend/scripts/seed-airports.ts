/**
 * Seed airports from OurAirports.com open data (public domain).
 * Run with: npx ts-node --transpile-only scripts/seed-airports.ts
 *
 * Downloads airports.csv (~7 MB), filters to airports with 4-letter ICAO codes,
 * and upserts them into the Airport table. Safe to re-run — clears and reloads.
 */
import { PrismaClient } from '@prisma/client'
import * as https from 'https'

const prisma = new PrismaClient()

const CSV_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
const BATCH_SIZE = 500
const INCLUDE_TYPES = new Set(['large_airport', 'medium_airport', 'small_airport', 'heliport'])

function downloadText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      let field = ''
      i++
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"'
          i += 2
        } else if (line[i] === '"') {
          i++
          break
        } else {
          field += line[i++]
        }
      }
      result.push(field)
      if (line[i] === ',') i++
    } else {
      const start = i
      while (i < line.length && line[i] !== ',') i++
      result.push(line.slice(start, i))
      if (line[i] === ',') i++
    }
  }
  return result
}

async function main() {
  console.log('Downloading OurAirports CSV...')
  const csv = await downloadText(CSV_URL)
  const lines = csv.split('\n')
  const headers = parseCsvLine(lines[0])

  const idx = {
    type: headers.indexOf('type'),
    name: headers.indexOf('name'),
    lat: headers.indexOf('latitude_deg'),
    lon: headers.indexOf('longitude_deg'),
    country: headers.indexOf('iso_country'),
    municipality: headers.indexOf('municipality'),
    icao: headers.indexOf('icao_code'),
    iata: headers.indexOf('iata_code'),
  }

  type AirportRecord = {
    icaoCode: string
    iataCode: string | null
    name: string
    municipality: string | null
    isoCountry: string
    type: string
    latitudeDeg: number | null
    longitudeDeg: number | null
  }

  const airports: AirportRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const f = parseCsvLine(line)
    const icaoCode = f[idx.icao]?.trim()
    const type = f[idx.type]?.trim()
    if (!icaoCode || icaoCode.length !== 4 || !INCLUDE_TYPES.has(type)) continue

    const lat = parseFloat(f[idx.lat])
    const lon = parseFloat(f[idx.lon])
    airports.push({
      icaoCode,
      iataCode: f[idx.iata]?.trim() || null,
      name: f[idx.name]?.trim() || '',
      municipality: f[idx.municipality]?.trim() || null,
      isoCountry: f[idx.country]?.trim() || '',
      type,
      latitudeDeg: isNaN(lat) ? null : lat,
      longitudeDeg: isNaN(lon) ? null : lon,
    })
  }

  console.log(`Parsed ${airports.length} airports. Clearing existing data...`)
  await prisma.airport.deleteMany({})

  console.log('Inserting in batches...')
  for (let i = 0; i < airports.length; i += BATCH_SIZE) {
    await prisma.airport.createMany({ data: airports.slice(i, i + BATCH_SIZE) })
    process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, airports.length)}/${airports.length}`)
  }

  console.log(`\nDone. Seeded ${airports.length} airports.`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())

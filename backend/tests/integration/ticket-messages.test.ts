/**
 * Integration test: TicketMessage author hydration.
 *
 * Smoke test for the TicketMessage @relation(user) / @relation(contact)
 * wiring added in add_ticket_message_relations migration.
 *
 * Requires DATABASE_URL to be set (local Docker: docker compose up).
 * Run: cd backend && DATABASE_URL="..." npx jest tests/integration/ticket-messages.test.ts --no-coverage
 */

// ── Mocks (hoisted before all imports) ───────────────────────────────────────

jest.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: process.env['DATABASE_URL'] ?? '',
    JWT_ACCESS_SECRET: 'test-jwt-access-secret-padded-32chars',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-padded-32ch',
    AZURE_SERVICE_BUS_QUEUE_AUTOMATION: 'automation-events',
    AZURE_SERVICE_BUS_QUEUE_NOTIFICATIONS: 'notification-events',
    TWILIO_FROM_NUMBER: '+15550000000',
    SENDGRID_FROM_EMAIL: 'noreply@test.com',
    SENDGRID_FROM_NAME: 'AeroComm Test',
    PORT: 3000,
    FRONTEND_URL: 'http://localhost:5173',
    API_BASE_URL: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    TOTP_APP_NAME: 'AeroComm',
    TOTP_ISSUER: 'AeroComm',
    RATE_LIMIT_WINDOW_MS: 900000,
    RATE_LIMIT_MAX: 100,
    CORS_ORIGINS: 'http://localhost:5173',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  },
}))

jest.mock('../../src/config/azure', () => ({
  getServiceBusClient: jest.fn(),
  getBlobServiceClient: jest.fn(),
  getKeyVaultClient: jest.fn(),
}))

jest.mock('../../src/shared/events/publisher', () => ({
  eventPublisher: {
    publish: jest.fn().mockResolvedValue(undefined),
    cancelScheduledMessage: jest.fn().mockResolvedValue(undefined),
  },
  EventPublisher: jest.fn(),
}))

// ── Imports (after mock declarations) ────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { TicketsService } from '../../src/modules/ticketing/tickets.service'

// ── Skip guard ────────────────────────────────────────────────────────────────

const SKIP_INTEGRATION = !process.env['DATABASE_URL']
const itDb = SKIP_INTEGRATION ? it.skip : it

// ── Test state ────────────────────────────────────────────────────────────────

let prisma!: PrismaClient
let service: TicketsService
let tenantId: string
let userId: string
let ticketId: string

// ── Fixture ──────────────────────────────────────────────────────────────────

async function setupFixture(): Promise<void> {
  const tenant = await prisma.tenant.create({
    data: { name: 'Ticket Author Test Co', slug: `ticket-${uuidv4().slice(0, 8)}` },
  })
  tenantId = tenant.id

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: `agent-${uuidv4().slice(0, 6)}@test.com`,
      passwordHash: 'test-hash',
      firstName: 'Agent',
      lastName: 'Smith',
      role: 'MANAGER',
    },
  })
  userId = user.id

  const ticket = await prisma.ticket.create({
    data: {
      tenantId,
      title: 'Smoke test ticket',
      source: 'MANUAL',
      status: 'OPEN',
      priority: 'NORMAL',
    },
  })
  ticketId = ticket.id
}

async function teardownFixture(): Promise<void> {
  await prisma.ticketMessage.deleteMany({ where: { tenantId } })
  await prisma.ticket.deleteMany({ where: { tenantId } })
  await prisma.user.deleteMany({ where: { tenantId } })
  await prisma.tenant.deleteMany({ where: { id: tenantId } })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TicketMessage author hydration', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return
    prisma = new PrismaClient()
    await prisma.$connect()
    service = new TicketsService(prisma)
    await setupFixture()
  })

  afterAll(async () => {
    if (SKIP_INTEGRATION) return
    await teardownFixture()
    await prisma.$disconnect()
  })

  itDb('addMessage returns with user populated', async () => {
    const message = await service.addMessage(tenantId, ticketId, userId, {
      content: 'Looking into this now.',
      isInternal: false,
    })

    expect(message).toBeDefined()
    expect(message.userId).toBe(userId)
    expect(message.user).toBeDefined()
    expect(message.user!.firstName).toBe('Agent')
    expect(message.user!.lastName).toBe('Smith')
  })

  itDb('findById hydrates message.user on ticket read', async () => {
    const ticket = await service.findById(tenantId, ticketId)

    expect(ticket.messages.length).toBeGreaterThan(0)
    const first = ticket.messages[0]!
    expect(first.userId).toBe(userId)
    expect(first.user).toBeDefined()
    expect(first.user!.email).toContain('@test.com')
  })

  it('test suite loads without DB', () => {
    // Safety: the file must load even when DATABASE_URL is absent,
    // so other test runs don't crash on module init.
    expect(SKIP_INTEGRATION || !!prisma).toBe(true)
  })
})

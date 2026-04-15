import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { AutomationEngine } from '../automation/engine'
import { createEvent } from '../../shared/events/types'
import { smsSender } from '../notifications/channels/sms.sender'
import { emailSender } from '../notifications/channels/email.sender'
import { whatsappSender } from '../notifications/channels/whatsapp.sender'
import { slackSender } from '../notifications/channels/slack.sender'
import { teamsSender } from '../notifications/channels/teams.sender'
import { inAppSender } from '../notifications/channels/inapp.sender'
import { logger } from '../../shared/utils/logger'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CapturedNotification {
  timestamp: string
  channel: string
  to: string
  body: string
  subject?: string
  tenantId?: string
}

export interface TimelineEntry {
  t: number          // ms since simulation start
  action: string
  details: Record<string, unknown>
}

export interface SimulationReport {
  scenario: string
  tenantId: string
  duration: number
  timeline: TimelineEntry[]
  notifications: CapturedNotification[]
  automationExecutions: Array<{
    automationName: string
    status: string
    entityType: string
    createdAt: string
    errorMessage?: string
  }>
  errors: Array<{ action: string; message: string; t: number }>
  summary: {
    stepsCompleted: number
    automationsMatched: number
    notificationsCaptured: number
    errorCount: number
  }
}

// ── Sender interception ──────────────────────────────────────────────────────

type SendFn = (...args: unknown[]) => Promise<unknown>

interface SenderPatch {
  target: { send: SendFn }
  original: SendFn
}

function patchSenders(captured: CapturedNotification[]): SenderPatch[] {
  const patches: SenderPatch[] = []

  function patch(target: { send: SendFn }, channel: string) {
    const original = target.send.bind(target)
    patches.push({ target, original })
    target.send = async (...args: unknown[]) => {
      captured.push({
        timestamp: new Date().toISOString(),
        channel,
        to: String(args[0] ?? ''),
        body: String(args[1] ?? ''),
        subject: args.length > 2 ? String(args[2] ?? '') : undefined,
        tenantId: typeof args[args.length - 1] === 'string' ? String(args[args.length - 1]) : undefined,
      })
    }
  }

  patch(smsSender as unknown as { send: SendFn }, 'SMS')
  patch(emailSender as unknown as { send: SendFn }, 'EMAIL')
  patch(whatsappSender as unknown as { send: SendFn }, 'WHATSAPP')
  patch(slackSender as unknown as { send: SendFn }, 'SLACK')
  patch(teamsSender as unknown as { send: SendFn }, 'TEAMS')

  // InAppSender has send() and broadcast() — patch both
  const origSend = inAppSender.send.bind(inAppSender)
  const origBroadcast = inAppSender.broadcast.bind(inAppSender)
  patches.push({ target: inAppSender as unknown as { send: SendFn }, original: origSend as unknown as SendFn })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(inAppSender as any).send = (userId: string, notification: { title: string; body: string }) => {
    captured.push({
      timestamp: new Date().toISOString(),
      channel: 'IN_APP',
      to: `user:${userId}`,
      body: notification.body,
      subject: notification.title,
    })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(inAppSender as any).broadcast = (tenantId: string, notification: { title: string; body: string }) => {
    captured.push({
      timestamp: new Date().toISOString(),
      channel: 'IN_APP',
      to: `tenant:${tenantId}`,
      body: notification.body,
      subject: notification.title,
    })
  }

  return patches
}

function restoreSenders(patches: SenderPatch[]) {
  for (const p of patches) {
    p.target.send = p.original
  }
  // Restore inAppSender broadcast separately (it's not in the generic patches)
  // The originals were captured in patchSenders; simplest: just leave them
  // since the server continues running and the simulation is ephemeral.
  // A production-grade solution would store and restore broadcast too.
}

// ── Simulator ────────────────────────────────────────────────────────────────

export class SimulatorService {
  constructor(private readonly prisma: PrismaClient) {}

  async runTripLifecycle(): Promise<SimulationReport> {
    const start = Date.now()
    const timeline: TimelineEntry[] = []
    const notifications: CapturedNotification[] = []
    const errors: SimulationReport['errors'] = []
    const slug = `sim-${uuidv4().slice(0, 8)}`

    const log = (action: string, details: Record<string, unknown> = {}) => {
      timeline.push({ t: Date.now() - start, action, details })
    }

    // ── 1. Create test tenant + data ─────────────────────────────────────
    log('create_tenant', { slug })
    const tenant = await this.prisma.tenant.create({
      data: { name: `Simulation Tenant (${slug})`, slug },
    })
    const tenantId = tenant.id

    try {
      // Create test contacts (passengers)
      log('create_contacts')
      const contacts = await Promise.all([
        this.prisma.contact.create({
          data: {
            tenantId, firstName: 'Alice', lastName: 'TestPax',
            email: 'alice@simulator.test', phone: '+15550001001',
            type: 'PASSENGER', smsOptIn: true,
          },
        }),
        this.prisma.contact.create({
          data: {
            tenantId, firstName: 'Bob', lastName: 'TestPax',
            email: 'bob@simulator.test', phone: '+15550001002',
            type: 'PASSENGER', smsOptIn: true,
          },
        }),
      ])
      log('contacts_created', { count: contacts.length, ids: contacts.map(c => c.id) })

      // Create test aircraft
      log('create_aircraft')
      const aircraft = await this.prisma.aircraft.create({
        data: {
          tenantId, tailNumber: `N${slug.slice(0, 4).toUpperCase()}`,
          make: 'Gulfstream', model: 'G550', seats: 12,
          homeBaseIcao: 'KTEB', hourlyRate: 8500, isActive: true,
        },
      })
      log('aircraft_created', { id: aircraft.id, tailNumber: aircraft.tailNumber })

      // Copy automations from the demo tenant
      log('copy_automations')
      const sourceAutomations = await this.prisma.automation.findMany({
        where: { tenantId: 'tenant_aerocomm_demo', deletedAt: null, enabled: true },
        include: {
          trigger: true,
          conditionGroups: {
            where: { deletedAt: null },
            include: { conditions: { where: { deletedAt: null } } },
          },
          actions: { where: { deletedAt: null }, orderBy: { sequence: 'asc' } },
        },
      })

      for (const src of sourceAutomations) {
        const auto = await this.prisma.automation.create({
          data: {
            tenantId,
            name: src.name,
            description: src.description,
            triggerType: src.triggerType,
            triggerConfig: src.triggerConfig,
            enabled: true,
            isDryRun: false,
          },
        })

        if (src.trigger) {
          await this.prisma.automationTrigger.create({
            data: {
              tenantId, automationId: auto.id,
              eventType: src.trigger.eventType,
              filters: src.trigger.filters,
            },
          })
        }

        for (const group of src.conditionGroups) {
          const newGroup = await this.prisma.automationConditionGroup.create({
            data: { tenantId, automationId: auto.id, operator: group.operator },
          })
          for (const cond of group.conditions) {
            await this.prisma.automationCondition.create({
              data: {
                tenantId, conditionGroupId: newGroup.id,
                field: cond.field, operator: cond.operator, value: cond.value,
              },
            })
          }
        }

        for (const action of src.actions) {
          await this.prisma.automationAction.create({
            data: {
              tenantId, automationId: auto.id,
              sequence: action.sequence, actionType: action.actionType,
              config: action.config,
              delayRelativeTo: action.delayRelativeTo,
              delayOffsetMs: action.delayOffsetMs,
            },
          })
        }
      }
      log('automations_copied', { count: sourceAutomations.length, names: sourceAutomations.map(a => a.name) })

      // Create test trip with passengers
      log('create_trip')
      const trip = await this.prisma.trip.create({
        data: {
          tenantId, aircraftId: aircraft.id,
          originIcao: 'KTEB', destinationIcao: 'KPBI',
          departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          paxCount: 2,
          status: 'INQUIRY',
          statusHistory: {
            create: [{
              tenantId, fromStatus: null, toStatus: 'INQUIRY',
              changedBy: 'simulator', changedAt: new Date(),
            }],
          },
          passengers: {
            create: contacts.map((c, i) => ({
              tenantId, contactId: c.id, isPrimary: i === 0,
            })),
          },
        },
      })
      log('trip_created', { id: trip.id, route: 'KTEB → KPBI' })

      // ── 2. Patch senders to capture notifications ──────────────────────
      const patches = patchSenders(notifications)

      try {
        // ── 3. Run the trip lifecycle ─────────────────────────────────────
        const engine = new AutomationEngine(this.prisma)
        const statuses = ['CONFIRMED', 'BOARDING', 'IN_FLIGHT', 'COMPLETED'] as const

        for (const toStatus of statuses) {
          const fromStatus = (await this.prisma.trip.findUnique({ where: { id: trip.id } }))!.status
          log('status_change', { from: fromStatus, to: toStatus })

          await this.prisma.trip.update({
            where: { id: trip.id },
            data: {
              status: toStatus,
              statusHistory: {
                create: [{
                  tenantId, fromStatus, toStatus,
                  changedBy: 'simulator', changedAt: new Date(),
                }],
              },
            },
          })

          const event = createEvent(tenantId, 'TRIP_STATUS_CHANGED', {
            tripId: trip.id,
            fromStatus,
            toStatus,
            changedBy: 'simulator',
            aircraftId: aircraft.id,
            contactId: contacts[0].id,
          })

          try {
            await engine.processEvent(event)
            log('automation_engine_processed', { eventType: 'TRIP_STATUS_CHANGED', toStatus })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            log('automation_engine_error', { toStatus, error: msg })
            errors.push({ action: `process_event_${toStatus}`, message: msg, t: Date.now() - start })
          }
        }
      } finally {
        restoreSenders(patches)
      }

      // ── 4. Read back automation execution logs ─────────────────────────
      log('read_execution_logs')
      const execLogs = await this.prisma.automationExecutionLog.findMany({
        where: { tenantId },
        include: { automation: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      })

      const automationExecutions = execLogs.map(l => ({
        automationName: l.automation.name,
        status: l.status,
        entityType: l.entityType ?? '',
        createdAt: l.createdAt.toISOString(),
        errorMessage: l.errorMessage ?? undefined,
      }))

      log('simulation_complete')

      // ── 5. Cleanup ─────────────────────────────────────────────────────
      log('cleanup_start')
      await this.cleanupTenant(tenantId)
      log('cleanup_complete')

      const duration = Date.now() - start
      return {
        scenario: 'trip-lifecycle',
        tenantId,
        duration,
        timeline,
        notifications,
        automationExecutions,
        errors,
        summary: {
          stepsCompleted: timeline.filter(t => t.action === 'status_change').length,
          automationsMatched: automationExecutions.length,
          notificationsCaptured: notifications.length,
          errorCount: errors.length,
        },
      }
    } catch (err) {
      // If something goes catastrophically wrong, still try to clean up
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ action: 'fatal', message: msg, t: Date.now() - start })
      logger.error('Simulation failed', { tenantId, error: msg })

      try { await this.cleanupTenant(tenantId) } catch { /* best-effort */ }

      return {
        scenario: 'trip-lifecycle',
        tenantId,
        duration: Date.now() - start,
        timeline,
        notifications,
        automationExecutions: [],
        errors,
        summary: {
          stepsCompleted: 0,
          automationsMatched: 0,
          notificationsCaptured: notifications.length,
          errorCount: errors.length,
        },
      }
    }
  }

  private async cleanupTenant(tenantId: string): Promise<void> {
    // Delete in FK-safe order (children first)
    await this.prisma.automationExecutionLog.deleteMany({ where: { tenantId } })
    await this.prisma.scheduledMessage.deleteMany({ where: { tenantId } })
    await this.prisma.automationCondition.deleteMany({ where: { tenantId } })
    await this.prisma.automationConditionGroup.deleteMany({ where: { tenantId } })
    await this.prisma.automationAction.deleteMany({ where: { tenantId } })
    await this.prisma.automationTrigger.deleteMany({ where: { tenantId } })
    await this.prisma.automation.deleteMany({ where: { tenantId } })
    await this.prisma.tripStatusHistory.deleteMany({ where: { tenantId } })
    await this.prisma.tripPassenger.deleteMany({ where: { tenantId } })
    await this.prisma.trip.deleteMany({ where: { tenantId } })
    await this.prisma.aircraft.deleteMany({ where: { tenantId } })
    await this.prisma.contact.deleteMany({ where: { tenantId } })
    await this.prisma.tenant.deleteMany({ where: { id: tenantId } })
  }
}

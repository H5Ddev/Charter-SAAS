import { v4 as uuidv4 } from 'uuid'

export type TriggerEventType =
  | 'TRIP_STATUS_CHANGED'
  | 'TRIP_DELAY_FLAGGED'
  | 'QUOTE_CREATED'
  | 'QUOTE_ACCEPTED'
  | 'QUOTE_EXPIRED'
  | 'QUOTE_DECLINED'
  | 'TICKET_OPENED'
  | 'TICKET_SLA_BREACHED'
  | 'TICKET_ESCALATED'
  | 'CONTACT_CREATED'
  | 'CONTACT_FIELD_UPDATED'
  | 'SCHEDULE_CRON'
  | 'INBOUND_WEBHOOK'
  | 'PAYMENT_STATUS_CHANGED'

export interface BaseEvent {
  eventId: string
  tenantId: string
  eventType: TriggerEventType
  occurredAt: string
  payload: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed Event Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface TripStatusChangedPayload {
  tripId: string
  fromStatus: string | null
  toStatus: string
  changedBy: string
  aircraftId?: string
  contactId?: string
  [key: string]: unknown
}

export interface TripStatusChangedEvent extends BaseEvent {
  eventType: 'TRIP_STATUS_CHANGED'
  payload: TripStatusChangedPayload
}

export interface TripDelayFlaggedPayload {
  tripId: string
  delayNotes: string
  flaggedBy: string
  [key: string]: unknown
}

export interface TripDelayFlaggedEvent extends BaseEvent {
  eventType: 'TRIP_DELAY_FLAGGED'
  payload: TripDelayFlaggedPayload
}

export interface QuoteCreatedPayload {
  quoteId: string
  contactId: string
  basePrice: number
  totalPrice: number
  currency: string
  [key: string]: unknown
}

export interface QuoteCreatedEvent extends BaseEvent {
  eventType: 'QUOTE_CREATED'
  payload: QuoteCreatedPayload
}

export interface QuoteAcceptedPayload {
  quoteId: string
  contactId: string
  signedAt: string
  signatureUrl?: string
  [key: string]: unknown
}

export interface QuoteAcceptedEvent extends BaseEvent {
  eventType: 'QUOTE_ACCEPTED'
  payload: QuoteAcceptedPayload
}

export interface QuoteExpiredPayload {
  quoteId: string
  contactId: string
  validUntil: string
  [key: string]: unknown
}

export interface QuoteExpiredEvent extends BaseEvent {
  eventType: 'QUOTE_EXPIRED'
  payload: QuoteExpiredPayload
}

export interface QuoteDeclinedPayload {
  quoteId: string
  contactId: string
  [key: string]: unknown
}

export interface QuoteDeclinedEvent extends BaseEvent {
  eventType: 'QUOTE_DECLINED'
  payload: QuoteDeclinedPayload
}

export interface TicketOpenedPayload {
  ticketId: string
  contactId?: string
  tripId?: string
  source: string
  priority: string
  title: string
  [key: string]: unknown
}

export interface TicketOpenedEvent extends BaseEvent {
  eventType: 'TICKET_OPENED'
  payload: TicketOpenedPayload
}

export interface TicketSlaBreachedPayload {
  ticketId: string
  contactId?: string
  assignedTo?: string
  slaBreachAt: string
  [key: string]: unknown
}

export interface TicketSlaBreachedEvent extends BaseEvent {
  eventType: 'TICKET_SLA_BREACHED'
  payload: TicketSlaBreachedPayload
}

export interface TicketEscalatedPayload {
  ticketId: string
  escalatedBy: string
  escalatedTo: string
  previousPriority: string
  newPriority: string
  [key: string]: unknown
}

export interface TicketEscalatedEvent extends BaseEvent {
  eventType: 'TICKET_ESCALATED'
  payload: TicketEscalatedPayload
}

export interface ContactCreatedPayload {
  contactId: string
  type: string
  email?: string
  phone?: string
  [key: string]: unknown
}

export interface ContactCreatedEvent extends BaseEvent {
  eventType: 'CONTACT_CREATED'
  payload: ContactCreatedPayload
}

export interface ContactFieldUpdatedPayload {
  contactId: string
  field: string
  oldValue: unknown
  newValue: unknown
  updatedBy: string
  [key: string]: unknown
}

export interface ContactFieldUpdatedEvent extends BaseEvent {
  eventType: 'CONTACT_FIELD_UPDATED'
  payload: ContactFieldUpdatedPayload
}

export interface ScheduleCronPayload {
  cronExpression: string
  scheduledAt: string
  [key: string]: unknown
}

export interface ScheduleCronEvent extends BaseEvent {
  eventType: 'SCHEDULE_CRON'
  payload: ScheduleCronPayload
}

export interface InboundWebhookPayload {
  integrationName: string
  integrationId: string
  webhookEventId: string
  rawEventType: string
  [key: string]: unknown
}

export interface InboundWebhookEvent extends BaseEvent {
  eventType: 'INBOUND_WEBHOOK'
  payload: InboundWebhookPayload
}

export interface PaymentStatusChangedPayload {
  paymentIntentId: string
  status: string
  amount: number
  currency: string
  customerId?: string
  quoteId?: string
  tripId?: string
  [key: string]: unknown
}

export interface PaymentStatusChangedEvent extends BaseEvent {
  eventType: 'PAYMENT_STATUS_CHANGED'
  payload: PaymentStatusChangedPayload
}

export type AeroCommEvent =
  | TripStatusChangedEvent
  | TripDelayFlaggedEvent
  | QuoteCreatedEvent
  | QuoteAcceptedEvent
  | QuoteExpiredEvent
  | QuoteDeclinedEvent
  | TicketOpenedEvent
  | TicketSlaBreachedEvent
  | TicketEscalatedEvent
  | ContactCreatedEvent
  | ContactFieldUpdatedEvent
  | ScheduleCronEvent
  | InboundWebhookEvent
  | PaymentStatusChangedEvent

// ─────────────────────────────────────────────────────────────────────────────
// Event factory helper
// ─────────────────────────────────────────────────────────────────────────────

export function createEvent<T extends AeroCommEvent>(
  tenantId: string,
  eventType: T['eventType'],
  payload: T['payload'],
): T {
  return {
    eventId: uuidv4(),
    tenantId,
    eventType,
    occurredAt: new Date().toISOString(),
    payload,
  } as T
}

/**
 * Application-level enum types.
 * SQL Server does not support Prisma enum types, so all enum fields are stored
 * as String in the database and validated at the application layer.
 */

// ─── User ────────────────────────────────────────────────────────────────────

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  AGENT: 'AGENT',
  READ_ONLY: 'READ_ONLY',
} as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

// ─── Contact ─────────────────────────────────────────────────────────────────

export const ContactType = {
  PASSENGER: 'PASSENGER',
  BROKER: 'BROKER',
  OPERATOR: 'OPERATOR',
  VENDOR: 'VENDOR',
  OTHER: 'OTHER',
} as const
export type ContactType = (typeof ContactType)[keyof typeof ContactType]

export const PreferredChannel = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  WHATSAPP: 'WHATSAPP',
  PHONE: 'PHONE',
} as const
export type PreferredChannel = (typeof PreferredChannel)[keyof typeof PreferredChannel]

// ─── Trip ─────────────────────────────────────────────────────────────────────

export const TripStatus = {
  INQUIRY: 'INQUIRY',
  QUOTED: 'QUOTED',
  CONFIRMED: 'CONFIRMED',
  BOARDING: 'BOARDING',
  IN_FLIGHT: 'IN_FLIGHT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const
export type TripStatus = (typeof TripStatus)[keyof typeof TripStatus]

// ─── Quote ────────────────────────────────────────────────────────────────────

export const QuoteStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
} as const
export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus]

// ─── Ticket ──────────────────────────────────────────────────────────────────

export const TicketStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus]

export const TicketSource = {
  MANUAL: 'MANUAL',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  WHATSAPP: 'WHATSAPP',
  WEB: 'WEB',
  API: 'API',
} as const
export type TicketSource = (typeof TicketSource)[keyof typeof TicketSource]

export const TicketPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const
export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority]

// ─── Notifications ───────────────────────────────────────────────────────────

export const NotificationChannel = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  WHATSAPP: 'WHATSAPP',
  SLACK: 'SLACK',
  TEAMS: 'TEAMS',
  PUSH: 'PUSH',
} as const
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel]

// ─── Automation ──────────────────────────────────────────────────────────────

export const AutomationTriggerType = {
  TRIP_STATUS_CHANGED: 'TRIP_STATUS_CHANGED',
  TRIP_DELAY_FLAGGED: 'TRIP_DELAY_FLAGGED',
  QUOTE_CREATED: 'QUOTE_CREATED',
  QUOTE_ACCEPTED: 'QUOTE_ACCEPTED',
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',
  QUOTE_DECLINED: 'QUOTE_DECLINED',
  TICKET_OPENED: 'TICKET_OPENED',
  TICKET_SLA_BREACHED: 'TICKET_SLA_BREACHED',
  TICKET_ESCALATED: 'TICKET_ESCALATED',
  CONTACT_CREATED: 'CONTACT_CREATED',
  CONTACT_FIELD_UPDATED: 'CONTACT_FIELD_UPDATED',
  SCHEDULE_CRON: 'SCHEDULE_CRON',
  INBOUND_WEBHOOK: 'INBOUND_WEBHOOK',
  PAYMENT_STATUS_CHANGED: 'PAYMENT_STATUS_CHANGED',
} as const
export type AutomationTriggerType = (typeof AutomationTriggerType)[keyof typeof AutomationTriggerType]

export const AutomationActionType = {
  SEND_SMS: 'SEND_SMS',
  SEND_EMAIL: 'SEND_EMAIL',
  SEND_WHATSAPP: 'SEND_WHATSAPP',
  SEND_SLACK: 'SEND_SLACK',
  SEND_TEAMS: 'SEND_TEAMS',
  WAIT_DELAY: 'WAIT_DELAY',
  UPDATE_TRIP_FIELD: 'UPDATE_TRIP_FIELD',
  UPDATE_CONTACT_FIELD: 'UPDATE_CONTACT_FIELD',
  CREATE_TICKET: 'CREATE_TICKET',
  ASSIGN_TICKET: 'ASSIGN_TICKET',
  FIRE_WEBHOOK: 'FIRE_WEBHOOK',
  CHAIN_AUTOMATION: 'CHAIN_AUTOMATION',
  GENERATE_PDF: 'GENERATE_PDF',
  ADD_NOTE: 'ADD_NOTE',
} as const
export type AutomationActionType = (typeof AutomationActionType)[keyof typeof AutomationActionType]

export const AutomationExecutionStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const
export type AutomationExecutionStatus = (typeof AutomationExecutionStatus)[keyof typeof AutomationExecutionStatus]

export const ConditionOperator = {
  EQUALS: 'EQUALS',
  NOT_EQUALS: 'NOT_EQUALS',
  CONTAINS: 'CONTAINS',
  GT: 'GT',
  LT: 'LT',
  IS_EMPTY: 'IS_EMPTY',
  IS_NOT_EMPTY: 'IS_NOT_EMPTY',
  IN: 'IN',
  NOT_IN: 'NOT_IN',
} as const
export type ConditionOperator = (typeof ConditionOperator)[keyof typeof ConditionOperator]

export const ConditionGroupOperator = {
  AND: 'AND',
  OR: 'OR',
} as const
export type ConditionGroupOperator = (typeof ConditionGroupOperator)[keyof typeof ConditionGroupOperator]

export const ScheduledMessageStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const
export type ScheduledMessageStatus = (typeof ScheduledMessageStatus)[keyof typeof ScheduledMessageStatus]

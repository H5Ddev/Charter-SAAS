import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import {
  useAutomation,
  type Automation,
  type AutomationActionType,
  type AutomationTriggerType,
} from '@/api/automations.api'
import {
  BoltIcon,
  PencilSquareIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

// ── Label maps ────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  TRIP_STATUS_CHANGED: 'Trip Status Changed',
  TRIP_DELAY_FLAGGED: 'Trip Delay Flagged',
  QUOTE_CREATED: 'Quote Created',
  QUOTE_ACCEPTED: 'Quote Accepted',
  QUOTE_DECLINED: 'Quote Declined',
  QUOTE_EXPIRED: 'Quote Expired',
  TICKET_OPENED: 'Ticket Opened',
  TICKET_SLA_BREACHED: 'Ticket SLA Breached',
  TICKET_ESCALATED: 'Ticket Escalated',
  CONTACT_CREATED: 'Contact Created',
  CONTACT_FIELD_UPDATED: 'Contact Field Updated',
  SCHEDULE_CRON: 'Scheduled (Cron)',
  INBOUND_WEBHOOK: 'Inbound Webhook',
  PAYMENT_STATUS_CHANGED: 'Payment Status Changed',
}

const TRIGGER_BADGE: Record<string, BadgeVariant> = {
  TRIP_STATUS_CHANGED: 'primary',
  TRIP_DELAY_FLAGGED: 'warning',
  QUOTE_CREATED: 'purple',
  QUOTE_ACCEPTED: 'success',
  QUOTE_DECLINED: 'danger',
  QUOTE_EXPIRED: 'warning',
  TICKET_OPENED: 'warning',
  TICKET_SLA_BREACHED: 'danger',
  TICKET_ESCALATED: 'danger',
  CONTACT_CREATED: 'info',
  CONTACT_FIELD_UPDATED: 'info',
  SCHEDULE_CRON: 'default',
  INBOUND_WEBHOOK: 'default',
  PAYMENT_STATUS_CHANGED: 'success',
}

const ACTION_LABELS: Record<AutomationActionType, string> = {
  SEND_SMS: 'Send SMS',
  SEND_EMAIL: 'Send Email',
  SEND_WHATSAPP: 'Send WhatsApp',
  SEND_SLACK: 'Send Slack Message',
  SEND_TEAMS: 'Send Teams Message',
  WAIT_DELAY: 'Wait / Delay',
  UPDATE_TRIP_FIELD: 'Update Trip Field',
  UPDATE_CONTACT_FIELD: 'Update Contact Field',
  CREATE_TICKET: 'Create Ticket',
  ASSIGN_TICKET: 'Assign Ticket',
  FIRE_WEBHOOK: 'Fire Webhook',
  CHAIN_AUTOMATION: 'Chain Automation',
  GENERATE_PDF: 'Generate PDF',
  ADD_NOTE: 'Add Note',
}

const ACTION_COLORS: Partial<Record<AutomationActionType, string>> = {
  SEND_SMS: 'bg-blue-50 border-blue-200 text-blue-700',
  SEND_WHATSAPP: 'bg-green-50 border-green-200 text-green-700',
  SEND_EMAIL: 'bg-purple-50 border-purple-200 text-purple-700',
  SEND_SLACK: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  SEND_TEAMS: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  WAIT_DELAY: 'bg-gray-50 border-gray-200 text-gray-600',
  CREATE_TICKET: 'bg-orange-50 border-orange-200 text-orange-700',
  FIRE_WEBHOOK: 'bg-pink-50 border-pink-200 text-pink-700',
}

const OPERATOR_LABELS: Record<string, string> = {
  EQUALS: '=',
  NOT_EQUALS: '≠',
  CONTAINS: 'contains',
  GT: '>',
  LT: '<',
  IS_EMPTY: 'is empty',
  IS_NOT_EMPTY: 'is not empty',
  IN: 'in',
  NOT_IN: 'not in',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function TriggerFilterSummary({ triggerType, config }: {
  triggerType: AutomationTriggerType
  config: Record<string, unknown>
}) {
  if (triggerType === 'TRIP_STATUS_CHANGED') {
    const from = config.fromStatus as string | undefined
    const to = config.toStatus as string | undefined
    if (!from && !to) return <span className="text-gray-400 italic">Any status change</span>
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs">
        {from ? <span className="bg-gray-100 px-1.5 py-0.5 rounded">{from}</span> : <span className="text-gray-400">Any</span>}
        <ArrowRightIcon className="h-3 w-3 text-gray-400" />
        {to ? <span className="bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded">{to}</span> : <span className="text-gray-400">Any</span>}
      </span>
    )
  }
  if (triggerType === 'SCHEDULE_CRON') {
    return <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{(config.cron as string) ?? '—'}</span>
  }
  const keys = Object.keys(config)
  if (keys.length === 0) return <span className="text-gray-400 italic">No filters</span>
  return (
    <span className="text-xs text-gray-600">
      {keys.map(k => `${k}: ${String(config[k])}`).join(', ')}
    </span>
  )
}

function ActionConfigDetail({ type, config }: {
  type: AutomationActionType
  config: Record<string, unknown>
}) {
  const rows: { label: string; value: string }[] = []

  if (type === 'SEND_SMS' || type === 'SEND_WHATSAPP' || type === 'SEND_EMAIL') {
    if (config.recipientType) rows.push({ label: 'Recipients', value: config.recipientType as string })
    if (config.to) rows.push({ label: 'To', value: config.to as string })
    if (config.toPath) rows.push({ label: 'To path', value: config.toPath as string })
    if (config.templateId) rows.push({ label: 'Template', value: config.templateId as string })
    if (config.subject) rows.push({ label: 'Subject', value: config.subject as string })
  }
  if (type === 'WAIT_DELAY') {
    if (config.duration) rows.push({ label: 'Duration', value: config.duration as string })
  }
  if (type === 'UPDATE_TRIP_FIELD' || type === 'UPDATE_CONTACT_FIELD') {
    if (config.field) rows.push({ label: 'Field', value: config.field as string })
    if (config.value !== undefined) rows.push({ label: 'Value', value: String(config.value) })
  }
  if (type === 'CREATE_TICKET') {
    if (config.title) rows.push({ label: 'Title', value: config.title as string })
    if (config.priority) rows.push({ label: 'Priority', value: config.priority as string })
    if (config.assignedTo) rows.push({ label: 'Assign to', value: config.assignedTo as string })
  }
  if (type === 'FIRE_WEBHOOK') {
    if (config.url) rows.push({ label: 'URL', value: config.url as string })
    if (config.method) rows.push({ label: 'Method', value: config.method as string })
  }
  if (type === 'CHAIN_AUTOMATION') {
    if (config.targetAutomationId) rows.push({ label: 'Target', value: config.targetAutomationId as string })
  }
  if (type === 'SEND_SLACK' || type === 'SEND_TEAMS') {
    if (config.webhookUrl) rows.push({ label: 'Webhook URL', value: config.webhookUrl as string })
  }
  if (type === 'ADD_NOTE') {
    if (config.noteTarget) rows.push({ label: 'Target', value: config.noteTarget as string })
    if (config.content) rows.push({ label: 'Content', value: config.content as string })
  }

  if (rows.length === 0) return null
  return (
    <dl className="mt-2 space-y-0.5">
      {rows.map(r => (
        <div key={r.label} className="flex items-baseline gap-2 text-xs">
          <dt className="text-gray-400 w-20 shrink-0">{r.label}</dt>
          <dd className="text-gray-700 font-mono truncate">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// ── Detail panel (uses fetched data) ─────────────────────────────────────────

function AutomationDetail({
  automation,
  onEdit,
  onLogs,
}: {
  automation: Automation
  onEdit: () => void
  onLogs: () => void
}) {
  const trigger = automation.triggers[0]

  return (
    <div className="space-y-6 text-sm">
      {/* Status + meta row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
          automation.isActive
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-gray-100 border-gray-200 text-gray-500',
        )}>
          <span className={clsx('w-1.5 h-1.5 rounded-full', automation.isActive ? 'bg-green-500' : 'bg-gray-400')} />
          {automation.isActive ? 'Active' : 'Inactive'}
        </span>
        {automation.executionCount > 0 && (
          <span className="text-xs text-gray-400">
            {automation.executionCount.toLocaleString()} run{automation.executionCount !== 1 ? 's' : ''}
          </span>
        )}
        {automation.lastExecutedAt && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5" />
            Last run {formatDateTime(automation.lastExecutedAt)}
          </span>
        )}
      </div>

      {automation.description && (
        <p className="text-gray-600">{automation.description}</p>
      )}

      {/* Trigger */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Trigger</h3>
        <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <Badge variant={TRIGGER_BADGE[trigger?.eventType] ?? 'default'} size="sm">
            {TRIGGER_LABELS[trigger?.eventType] ?? trigger?.eventType ?? '—'}
          </Badge>
          {trigger && (
            <TriggerFilterSummary triggerType={trigger.eventType} config={trigger.config ?? {}} />
          )}
        </div>
      </section>

      {/* Conditions */}
      {automation.conditionGroups.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Conditions</h3>
          <div className="space-y-3">
            {automation.conditionGroups.map((group, gi) => (
              <div key={group.id ?? gi} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  {group.logicOperator} group
                </div>
                <div className="divide-y divide-gray-100">
                  {group.conditions.map((cond, ci) => (
                    <div key={cond.id ?? ci} className="px-3 py-2 flex items-center gap-2 font-mono text-xs">
                      <span className="text-gray-700">{cond.field}</span>
                      <span className="text-primary-600 font-semibold">{OPERATOR_LABELS[cond.operator] ?? cond.operator}</span>
                      {cond.value !== null && cond.value !== undefined && (
                        <span className="bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded">{cond.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Actions */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Actions ({automation.actions.length})
        </h3>
        {automation.actions.length === 0 ? (
          <p className="text-gray-400 italic text-xs">No actions configured</p>
        ) : (
          <div className="space-y-2">
            {automation.actions
              .sort((a, b) => a.order - b.order)
              .map((action, i) => (
                <div
                  key={action.id ?? i}
                  className={clsx(
                    'flex gap-3 p-3 rounded-lg border',
                    ACTION_COLORS[action.type] ?? 'bg-gray-50 border-gray-200 text-gray-700',
                  )}
                >
                  <div className="shrink-0 w-5 h-5 rounded-full bg-white/60 border border-current/20 flex items-center justify-center text-[10px] font-bold mt-0.5">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-xs">{ACTION_LABELS[action.type] ?? action.type}</p>
                    <ActionConfigDetail type={action.type} config={action.config} />
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Created / updated */}
      <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
        <span>Created {formatDateTime(automation.createdAt)}</span>
        <span>Updated {formatDateTime(automation.updatedAt)}</span>
      </div>
    </div>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

interface AutomationDetailModalProps {
  automationId: string | null
  onClose: () => void
  onEdit: (id: string) => void
  onLogs: (id: string) => void
}

export function AutomationDetailModal({
  automationId,
  onClose,
  onEdit,
  onLogs,
}: AutomationDetailModalProps) {
  const { data: automation, isLoading } = useAutomation(automationId ?? '')

  return (
    <Modal
      isOpen={!!automationId}
      onClose={onClose}
      title={automation?.name ?? 'Automation Details'}
      size="lg"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {automation && (
            <>
              <Button
                variant="ghost"
                onClick={() => { onLogs(automation.id); onClose() }}
              >
                <ClipboardDocumentListIcon className="h-4 w-4 mr-1.5" />
                View Logs
              </Button>
              <Button
                variant="primary"
                onClick={() => { onEdit(automation.id); onClose() }}
              >
                <PencilSquareIcon className="h-4 w-4 mr-1.5" />
                Edit
              </Button>
            </>
          )}
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : automation ? (
        <AutomationDetail
          automation={automation}
          onEdit={() => { onEdit(automation.id); onClose() }}
          onLogs={() => { onLogs(automation.id); onClose() }}
        />
      ) : (
        <p className="text-sm text-gray-500">Automation not found.</p>
      )}
    </Modal>
  )
}

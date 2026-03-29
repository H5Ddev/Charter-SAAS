import { type AutomationTriggerType } from '@/api/automations.api'
import Select from '@/components/ui/Select'

const TRIGGER_OPTIONS: { value: AutomationTriggerType; label: string; group: string }[] = [
  { value: 'CONTACT_CREATED', label: 'Contact Created', group: 'Contacts' },
  { value: 'CONTACT_FIELD_UPDATED', label: 'Contact Field Updated', group: 'Contacts' },
  { value: 'TRIP_STATUS_CHANGED', label: 'Trip Status Changed', group: 'Trips' },
  { value: 'TRIP_DELAY_FLAGGED', label: 'Trip Delay Flagged', group: 'Trips' },
  { value: 'QUOTE_CREATED', label: 'Quote Created', group: 'Quotes' },
  { value: 'QUOTE_ACCEPTED', label: 'Quote Accepted', group: 'Quotes' },
  { value: 'QUOTE_DECLINED', label: 'Quote Declined', group: 'Quotes' },
  { value: 'QUOTE_EXPIRED', label: 'Quote Expired', group: 'Quotes' },
  { value: 'TICKET_OPENED', label: 'Ticket Opened', group: 'Tickets' },
  { value: 'TICKET_SLA_BREACHED', label: 'Ticket SLA Breached', group: 'Tickets' },
  { value: 'TICKET_ESCALATED', label: 'Ticket Escalated', group: 'Tickets' },
  { value: 'PAYMENT_STATUS_CHANGED', label: 'Payment Status Changed', group: 'Payments' },
  { value: 'INBOUND_WEBHOOK', label: 'Inbound Webhook', group: 'Other' },
  { value: 'SCHEDULE_CRON', label: 'Scheduled (Cron)', group: 'Schedule' },
]

interface TriggerPickerProps {
  value: AutomationTriggerType | ''
  onChange: (value: AutomationTriggerType) => void
  error?: string
}

export function TriggerPicker({ value, onChange, error }: TriggerPickerProps) {
  return (
    <div className="space-y-2">
      <label className="form-label">Trigger Event</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AutomationTriggerType)}
        className={`form-input ${error ? 'border-red-500' : ''}`}
      >
        <option value="" disabled>
          Select a trigger event...
        </option>
        {Array.from(new Set(TRIGGER_OPTIONS.map((o) => o.group))).map((group) => (
          <optgroup key={group} label={group}>
            {TRIGGER_OPTIONS.filter((o) => o.group === group).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {value && (
        <p className="text-xs text-gray-500">
          This automation will fire whenever a{' '}
          <span className="font-medium">
            {TRIGGER_OPTIONS.find((o) => o.value === value)?.label}
          </span>{' '}
          event occurs.
        </p>
      )}
    </div>
  )
}

export default TriggerPicker

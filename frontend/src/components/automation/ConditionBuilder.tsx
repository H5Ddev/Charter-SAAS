import React, { useState, useRef, useEffect } from 'react';
import { PlusIcon, TrashIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';
import Button from '@/components/ui/Button';

// ── Available condition fields ────────────────────────────────────────────────

interface FieldDef {
  path: string
  label: string
  group: string
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'ARRAY'
  hint?: string
}

const CONDITION_FIELDS: FieldDef[] = [
  // Trip
  { path: 'trip.status',            label: 'Status',               group: 'Trip',    type: 'STRING',  hint: 'CONFIRMED, BOARDING, IN_FLIGHT…' },
  { path: 'trip.paxCount',          label: 'PAX Count',            group: 'Trip',    type: 'NUMBER' },
  { path: 'trip.isDelayed',         label: 'Is Delayed',           group: 'Trip',    type: 'BOOLEAN', hint: 'true / false' },
  { path: 'trip.originIcao',        label: 'Origin ICAO',          group: 'Trip',    type: 'STRING',  hint: 'e.g. KTEB' },
  { path: 'trip.destinationIcao',   label: 'Destination ICAO',     group: 'Trip',    type: 'STRING',  hint: 'e.g. KPBI' },
  { path: 'trip.fboName',           label: 'FBO Name',             group: 'Trip',    type: 'STRING' },
  { path: 'trip.notes',             label: 'Notes',                group: 'Trip',    type: 'STRING' },
  { path: 'trip.returnDepartureAt', label: 'Return Departure',     group: 'Trip',    type: 'DATE',    hint: 'Non-empty = round trip' },
  { path: 'trip.surveyLink',        label: 'Survey Link',          group: 'Trip',    type: 'STRING' },
  // Contact
  { path: 'contact.firstName',      label: 'First Name',           group: 'Contact', type: 'STRING' },
  { path: 'contact.lastName',       label: 'Last Name',            group: 'Contact', type: 'STRING' },
  { path: 'contact.email',          label: 'Email',                group: 'Contact', type: 'STRING' },
  { path: 'contact.phone',          label: 'Phone',                group: 'Contact', type: 'STRING' },
  { path: 'contact.type',           label: 'Type',                 group: 'Contact', type: 'STRING',  hint: 'PASSENGER, BROKER, OPERATOR…' },
  { path: 'contact.doNotContact',   label: 'Do Not Contact',       group: 'Contact', type: 'BOOLEAN' },
  { path: 'contact.smsOptIn',       label: 'SMS Opt-In',           group: 'Contact', type: 'BOOLEAN' },
  { path: 'contact.whatsappOptIn',  label: 'WhatsApp Opt-In',      group: 'Contact', type: 'BOOLEAN' },
  { path: 'contact.preferredChannel', label: 'Preferred Channel',  group: 'Contact', type: 'STRING',  hint: 'EMAIL, SMS, WHATSAPP…' },
  // Quote
  { path: 'quote.status',           label: 'Status',               group: 'Quote',   type: 'STRING',  hint: 'DRAFT, SENT, ACCEPTED…' },
  { path: 'quote.totalPrice',       label: 'Total Price',          group: 'Quote',   type: 'NUMBER' },
  { path: 'quote.currency',         label: 'Currency',             group: 'Quote',   type: 'STRING',  hint: 'USD, EUR…' },
  // Ticket
  { path: 'ticket.status',          label: 'Status',               group: 'Ticket',  type: 'STRING',  hint: 'OPEN, IN_PROGRESS, RESOLVED…' },
  { path: 'ticket.priority',        label: 'Priority',             group: 'Ticket',  type: 'STRING',  hint: 'LOW, NORMAL, HIGH, URGENT' },
  { path: 'ticket.source',          label: 'Source',               group: 'Ticket',  type: 'STRING',  hint: 'EMAIL, SMS, WEB, MANUAL' },
  { path: 'ticket.assignedTo',      label: 'Assigned To',          group: 'Ticket',  type: 'STRING' },
  // Aircraft
  { path: 'aircraft.tailNumber',    label: 'Tail Number',          group: 'Aircraft',type: 'STRING' },
  { path: 'aircraft.make',          label: 'Make',                 group: 'Aircraft',type: 'STRING' },
  { path: 'aircraft.model',         label: 'Model',                group: 'Aircraft',type: 'STRING' },
  { path: 'aircraft.seats',         label: 'Seats',                group: 'Aircraft',type: 'NUMBER' },
  // Tenant
  { path: 'tenant.name',            label: 'Company Name',         group: 'Tenant',  type: 'STRING' },
  { path: 'tenant.plan',            label: 'Plan',                 group: 'Tenant',  type: 'STRING',  hint: 'TRIAL, STARTER, PRO…' },
]

const TYPE_COLORS: Record<string, string> = {
  STRING:  'bg-blue-100 text-blue-700',
  NUMBER:  'bg-green-100 text-green-700',
  BOOLEAN: 'bg-purple-100 text-purple-700',
  DATE:    'bg-orange-100 text-orange-700',
  ARRAY:   'bg-gray-100 text-gray-600',
}

function FieldPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function openPicker() {
    setOpen(true)
    setSearch('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const query = search.toLowerCase()
  const filtered = CONDITION_FIELDS.filter(
    f => !query ||
      f.path.toLowerCase().includes(query) ||
      f.label.toLowerCase().includes(query) ||
      f.group.toLowerCase().includes(query) ||
      f.hint?.toLowerCase().includes(query)
  )

  const groups = Array.from(new Set(filtered.map(f => f.group)))

  const selectedDef = CONDITION_FIELDS.find(f => f.path === value)

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={openPicker}
        className="form-input w-52 text-sm text-left flex items-center justify-between gap-1 pr-2"
      >
        <span className={value ? 'font-mono text-gray-900' : 'text-gray-400'}>
          {value || 'Select field…'}
        </span>
        <ChevronUpDownIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search fields…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="text-xs text-gray-400 px-3 py-2 italic">No fields found</li>
            )}
            {groups.map(group => (
              <React.Fragment key={group}>
                <li className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {group}
                </li>
                {filtered.filter(f => f.group === group).map(f => (
                  <li key={f.path}>
                    <button
                      type="button"
                      onMouseDown={() => {
                        onChange(f.path)
                        setOpen(false)
                        setSearch('')
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-primary-50 flex items-start gap-2 group ${value === f.path ? 'bg-primary-50' : ''}`}
                    >
                      <span className={`mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLORS[f.type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {f.type}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-gray-800 group-hover:text-primary-700">{f.path}</div>
                        <div className="text-xs text-gray-400 truncate">{f.label}{f.hint ? ` · ${f.hint}` : ''}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </React.Fragment>
            ))}
          </ul>
          {selectedDef && (
            <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500 bg-gray-50 rounded-b-lg">
              Selected: <span className="font-mono text-gray-700">{selectedDef.path}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export type ConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'GT'
  | 'LT'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY'
  | 'IN'
  | 'NOT_IN';

export interface Condition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: string;
}

export interface ConditionGroup {
  id: string;
  operator: 'AND' | 'OR';
  conditions: Condition[];
}

interface ConditionBuilderProps {
  conditionGroups: ConditionGroup[];
  onChange: (groups: ConditionGroup[]) => void;
}

const OPERATOR_OPTIONS: { value: ConditionOperator; label: string; hasValue: boolean }[] = [
  { value: 'EQUALS', label: 'equals', hasValue: true },
  { value: 'NOT_EQUALS', label: 'does not equal', hasValue: true },
  { value: 'CONTAINS', label: 'contains', hasValue: true },
  { value: 'GT', label: 'greater than', hasValue: true },
  { value: 'LT', label: 'less than', hasValue: true },
  { value: 'IS_EMPTY', label: 'is empty', hasValue: false },
  { value: 'IS_NOT_EMPTY', label: 'is not empty', hasValue: false },
  { value: 'IN', label: 'is one of', hasValue: true },
  { value: 'NOT_IN', label: 'is not one of', hasValue: true },
];

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function newCondition(): Condition {
  return { id: generateId(), field: '', operator: 'EQUALS', value: '' };
}

function newGroup(): ConditionGroup {
  return { id: generateId(), operator: 'AND', conditions: [newCondition()] };
}

function ConditionRow({
  condition,
  onChange,
  onRemove,
  canRemove,
}: {
  condition: Condition;
  onChange: (updated: Condition) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const operatorDef = OPERATOR_OPTIONS.find(o => o.value === condition.operator);
  const hasValue = operatorDef?.hasValue ?? true;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <FieldPicker
        value={condition.field}
        onChange={v => onChange({ ...condition, field: v })}
      />
      <select
        value={condition.operator}
        onChange={e =>
          onChange({ ...condition, operator: e.target.value as ConditionOperator, value: '' })
        }
        className="form-input w-40 text-sm"
      >
        {OPERATOR_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hasValue ? (
        <input
          type="text"
          placeholder="value"
          value={condition.value}
          onChange={e => onChange({ ...condition, value: e.target.value })}
          className="form-input w-36 text-sm"
        />
      ) : (
        <span className="w-36 text-sm text-gray-400 italic">(no value needed)</span>
      )}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          aria-label="Remove condition"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function ConditionGroupPanel({
  group,
  onChange,
  onRemove,
  canRemove,
}: {
  group: ConditionGroup;
  onChange: (updated: ConditionGroup) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function setOperator(op: 'AND' | 'OR') {
    onChange({ ...group, operator: op });
  }

  function updateCondition(idx: number, updated: Condition) {
    const conditions = group.conditions.map((c, i) => (i === idx ? updated : c));
    onChange({ ...group, conditions });
  }

  function addCondition() {
    onChange({ ...group, conditions: [...group.conditions, newCondition()] });
  }

  function removeCondition(idx: number) {
    const conditions = group.conditions.filter((_, i) => i !== idx);
    onChange({ ...group, conditions });
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Match
          </span>
          <div className="flex rounded-md overflow-hidden border border-gray-300">
            {(['AND', 'OR'] as const).map(op => (
              <button
                key={op}
                type="button"
                onClick={() => setOperator(op)}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  group.operator === op
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {op}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-500">of the following conditions</span>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Remove group
          </button>
        )}
      </div>

      <div className="space-y-2 pl-2">
        {group.conditions.map((cond, idx) => (
          <React.Fragment key={cond.id}>
            {idx > 0 && (
              <div className="text-xs font-semibold text-primary-600 pl-1">
                {group.operator}
              </div>
            )}
            <ConditionRow
              condition={cond}
              onChange={updated => updateCondition(idx, updated)}
              onRemove={() => removeCondition(idx)}
              canRemove={group.conditions.length > 1}
            />
          </React.Fragment>
        ))}
      </div>

      <button
        type="button"
        onClick={addCondition}
        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add Condition
      </button>
    </div>
  );
}

export function ConditionBuilder({ conditionGroups, onChange }: ConditionBuilderProps) {
  function updateGroup(idx: number, updated: ConditionGroup) {
    onChange(conditionGroups.map((g, i) => (i === idx ? updated : g)));
  }

  function removeGroup(idx: number) {
    onChange(conditionGroups.filter((_, i) => i !== idx));
  }

  function addGroup() {
    onChange([...conditionGroups, newGroup()]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Conditions</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Leave empty to always run. Multiple groups are combined with OR logic.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={addGroup}>
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Group
        </Button>
      </div>

      {conditionGroups.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-400">No conditions — automation will always run.</p>
          <button
            type="button"
            onClick={addGroup}
            className="mt-2 text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            Add a condition group
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {conditionGroups.map((group, idx) => (
            <React.Fragment key={group.id}>
              {idx > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-xs font-semibold text-gray-400 uppercase">OR</span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
              )}
              <ConditionGroupPanel
                group={group}
                onChange={updated => updateGroup(idx, updated)}
                onRemove={() => removeGroup(idx)}
                canRemove={conditionGroups.length > 1}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

export default ConditionBuilder;

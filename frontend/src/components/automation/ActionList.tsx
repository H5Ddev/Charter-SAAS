import React, { useRef } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlusIcon, TrashIcon, Bars3Icon } from '@heroicons/react/24/outline';
import Button from '@/components/ui/Button';
import { VariablePicker } from './VariablePicker';
import type { AutomationActionType } from '@/api/automations.api';

export interface AutomationAction {
  id: string;
  order: number;
  type: ActionType;
  config: Record<string, unknown>;
  delayDuration?: string;
}

export type ActionType =
  | 'SEND_SMS'
  | 'SEND_EMAIL'
  | 'SEND_WHATSAPP'
  | 'SEND_SLACK'
  | 'SEND_TEAMS'
  | 'CREATE_TICKET'
  | 'UPDATE_TRIP_FIELD'
  | 'UPDATE_CONTACT_FIELD'
  | 'FIRE_WEBHOOK'
  | 'CHAIN_AUTOMATION'
  | 'WAIT_DELAY'
  | 'ADD_NOTE';

interface ActionListProps {
  actions: AutomationAction[];
  onChange: (actions: AutomationAction[]) => void;
}

const ACTION_TYPE_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'SEND_SMS', label: 'Send SMS' },
  { value: 'SEND_EMAIL', label: 'Send Email' },
  { value: 'SEND_WHATSAPP', label: 'Send WhatsApp' },
  { value: 'SEND_SLACK', label: 'Send Slack Message' },
  { value: 'SEND_TEAMS', label: 'Send Teams Message' },
  { value: 'CREATE_TICKET', label: 'Create Ticket' },
  { value: 'UPDATE_TRIP_FIELD', label: 'Update Trip Field' },
  { value: 'UPDATE_CONTACT_FIELD', label: 'Update Contact Field' },
  { value: 'FIRE_WEBHOOK', label: 'Fire Webhook' },
  { value: 'CHAIN_AUTOMATION', label: 'Chain Automation' },
  { value: 'WAIT_DELAY', label: 'Wait / Delay' },
  { value: 'ADD_NOTE', label: 'Add Note' },
];

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function newAction(order: number): AutomationAction {
  return { id: generateId(), order, type: 'SEND_SMS', config: {} };
}

// --- Config form helpers ---

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="form-input text-sm w-full"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  showVariablePicker = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  showVariablePicker?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(variable: string) {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + variable);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newValue = value.slice(0, start) + variable + value.slice(end);
    onChange(newValue);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + variable.length;
      el.focus();
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        {showVariablePicker && <VariablePicker onSelect={insertVariable} />}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="form-input text-sm w-full resize-y"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="form-input text-sm w-full"
      >
        <option value="">Select...</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// --- Per-type config forms ---

function ActionConfigForm({
  type,
  config,
  onChange,
}: {
  type: ActionType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  function str(key: string): string {
    return (config[key] as string) ?? '';
  }

  switch (type) {
    case 'SEND_SMS':
      return (
        <div className="space-y-3">
          <TextField label="To (phone or contactId)" value={str('to')} onChange={v => set('to', v)} placeholder="+1 555-555-5555 or {{passenger.phone}}" />
          <TextField label="Template ID" value={str('templateId')} onChange={v => set('templateId', v)} placeholder="tmpl_xxx" />
          <TextAreaField label="Raw Message (overrides template)" value={str('rawMessage')} onChange={v => set('rawMessage', v)} placeholder="Hi {{passenger.firstName}}, your flight departs at {{trip.departureTime}}." showVariablePicker />
        </div>
      );

    case 'SEND_EMAIL':
      return (
        <div className="space-y-3">
          <TextField label="To (email or contactId)" value={str('to')} onChange={v => set('to', v)} placeholder="{{passenger.email}}" />
          <TextField label="Template ID" value={str('templateId')} onChange={v => set('templateId', v)} placeholder="tmpl_xxx" />
          <TextField label="Subject" value={str('subject')} onChange={v => set('subject', v)} placeholder="Your upcoming flight on {{trip.departureDate}}" />
        </div>
      );

    case 'SEND_WHATSAPP':
      return (
        <div className="space-y-3">
          <TextField label="To (phone or contactId)" value={str('to')} onChange={v => set('to', v)} placeholder="+1 555-555-5555 or {{passenger.phone}}" />
          <TextField label="Template ID" value={str('templateId')} onChange={v => set('templateId', v)} placeholder="tmpl_xxx" />
        </div>
      );

    case 'SEND_SLACK':
      return (
        <div className="space-y-3">
          <TextField label="Channel" value={str('channel')} onChange={v => set('channel', v)} placeholder="#ops-alerts" />
          <TextAreaField label="Message" value={str('message')} onChange={v => set('message', v)} placeholder="Flight {{trip.departureDate}} is ready." showVariablePicker />
        </div>
      );

    case 'SEND_TEAMS':
      return (
        <div className="space-y-3">
          <TextField label="Webhook URL" value={str('webhookUrl')} onChange={v => set('webhookUrl', v)} placeholder="https://outlook.office.com/webhook/..." />
          <TextAreaField label="Message" value={str('message')} onChange={v => set('message', v)} placeholder="Notification text..." />
        </div>
      );

    case 'CREATE_TICKET':
      return (
        <div className="space-y-3">
          <TextField label="Title" value={str('title')} onChange={v => set('title', v)} placeholder="Issue with trip {{trip.departureDate}}" />
          <SelectField
            label="Priority"
            value={str('priority')}
            onChange={v => set('priority', v)}
            options={[
              { value: 'LOW', label: 'Low' },
              { value: 'NORMAL', label: 'Normal' },
              { value: 'HIGH', label: 'High' },
              { value: 'URGENT', label: 'Urgent' },
            ]}
          />
          <TextAreaField label="Body" value={str('body')} onChange={v => set('body', v)} placeholder="Describe the issue..." showVariablePicker />
        </div>
      );

    case 'UPDATE_TRIP_FIELD':
      return (
        <div className="space-y-3">
          <TextField label="Field" value={str('field')} onChange={v => set('field', v)} placeholder="status" />
          <TextField label="Value" value={str('value')} onChange={v => set('value', v)} placeholder="CONFIRMED" />
        </div>
      );

    case 'UPDATE_CONTACT_FIELD':
      return (
        <div className="space-y-3">
          <TextField label="Field" value={str('field')} onChange={v => set('field', v)} placeholder="preferredChannel" />
          <TextField label="Value" value={str('value')} onChange={v => set('value', v)} placeholder="EMAIL" />
        </div>
      );

    case 'FIRE_WEBHOOK':
      return (
        <div className="space-y-3">
          <TextField label="URL" value={str('url')} onChange={v => set('url', v)} placeholder="https://api.example.com/webhook" />
          <SelectField
            label="Method"
            value={str('method') || 'POST'}
            onChange={v => set('method', v)}
            options={[
              { value: 'GET', label: 'GET' },
              { value: 'POST', label: 'POST' },
              { value: 'PUT', label: 'PUT' },
              { value: 'PATCH', label: 'PATCH' },
            ]}
          />
          <TextAreaField label="Body (JSON)" value={str('body')} onChange={v => set('body', v)} placeholder='{"tripId": "{{trip.id}}"}' showVariablePicker />
        </div>
      );

    case 'CHAIN_AUTOMATION':
      return (
        <div className="space-y-3">
          <TextField label="Automation ID" value={str('automationId')} onChange={v => set('automationId', v)} placeholder="auto_xxx" />
        </div>
      );

    case 'WAIT_DELAY':
      return (
        <div className="space-y-3">
          <TextField label="Duration (ISO 8601)" value={str('duration')} onChange={v => set('duration', v)} placeholder="PT2H" />
          <p className="text-xs text-gray-400">
            Examples: <code className="bg-gray-100 px-1 rounded">PT30M</code> = 30 minutes,{' '}
            <code className="bg-gray-100 px-1 rounded">PT2H</code> = 2 hours,{' '}
            <code className="bg-gray-100 px-1 rounded">P1D</code> = 1 day,{' '}
            <code className="bg-gray-100 px-1 rounded">P1DT6H</code> = 1 day 6 hours
          </p>
        </div>
      );

    case 'ADD_NOTE':
      return (
        <div className="space-y-3">
          <SelectField
            label="Entity Type"
            value={str('entityType')}
            onChange={v => set('entityType', v)}
            options={[
              { value: 'contact', label: 'Contact' },
              { value: 'trip', label: 'Trip' },
              { value: 'ticket', label: 'Ticket' },
            ]}
          />
          <TextField label="Entity ID" value={str('entityId')} onChange={v => set('entityId', v)} placeholder="{{trip.id}}" />
          <TextAreaField label="Content" value={str('content')} onChange={v => set('content', v)} placeholder="Note content..." showVariablePicker />
        </div>
      );

    default:
      return <p className="text-sm text-gray-400">No configuration required for this action type.</p>;
  }
}

// --- Sortable action card ---

function SortableActionCard({
  action,
  onChange,
  onRemove,
}: {
  action: AutomationAction;
  onChange: (updated: AutomationAction) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: action.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-gray-200 rounded-lg bg-white shadow-sm"
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button
          type="button"
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
        <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
          {action.order}
        </span>
        <select
          value={action.type}
          onChange={e =>
            onChange({ ...action, type: e.target.value as ActionType, config: {} })
          }
          className="form-input text-sm flex-1"
        >
          {ACTION_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          aria-label="Remove action"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="px-4 py-3">
        <ActionConfigForm
          type={action.type}
          config={action.config}
          onChange={config => onChange({ ...action, config })}
        />
      </div>
    </div>
  );
}

// --- Main ActionList component ---

export function ActionList({ actions, onChange }: ActionListProps) {
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = actions.findIndex(a => a.id === active.id);
      const newIndex = actions.findIndex(a => a.id === over.id);
      const reordered = arrayMove(actions, oldIndex, newIndex).map((a, i) => ({
        ...a,
        order: i + 1,
      }));
      onChange(reordered);
    }
  }

  function addAction() {
    onChange([...actions, newAction(actions.length + 1)]);
  }

  function updateAction(idx: number, updated: AutomationAction) {
    onChange(actions.map((a, i) => (i === idx ? updated : a)));
  }

  function removeAction(idx: number) {
    onChange(
      actions
        .filter((_, i) => i !== idx)
        .map((a, i) => ({ ...a, order: i + 1 })),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Actions</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Actions execute in order. Drag to reorder.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={addAction}>
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Action
        </Button>
      </div>

      {actions.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-400">No actions yet. Add at least one action.</p>
          <button
            type="button"
            onClick={addAction}
            className="mt-2 text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            Add first action
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={actions.map(a => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {actions.map((action, idx) => (
                <SortableActionCard
                  key={action.id}
                  action={action}
                  onChange={updated => updateAction(idx, updated)}
                  onRemove={() => removeAction(idx)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

export default ActionList;

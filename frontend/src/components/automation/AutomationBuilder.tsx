import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { TriggerPicker } from './TriggerPicker';
import { ConditionBuilder, type ConditionGroup } from './ConditionBuilder';
import { ActionList, type AutomationAction } from './ActionList';
import { DryRunModal } from './DryRunModal';
import {
  useAutomation,
  useCreateAutomation,
  useUpdateAutomation,
  type AutomationTriggerType,
} from '@/api/automations.api';
import { CheckIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

interface AutomationBuilderProps {
  automationId?: string;
  onSave: () => void;
  onCancel: () => void;
}

type Step = 1 | 2 | 3;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: 'Trigger' },
  { id: 2, label: 'Conditions' },
  { id: 3, label: 'Actions' },
];

const TRIP_STATUSES = [
  'INQUIRY', 'QUOTED', 'CONFIRMED', 'MANIFEST_LOCKED', 'DEPARTED', 'COMPLETED', 'CANCELLED',
];

function StepIndicator({ current, steps }: { current: Step; steps: typeof STEPS }) {
  return (
    <nav className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, idx) => {
        const done = current > step.id;
        const active = current === step.id;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors',
                  done
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : active
                    ? 'border-primary-600 text-primary-600 bg-white'
                    : 'border-gray-300 text-gray-400 bg-white',
                )}
              >
                {done ? <CheckIcon className="h-4 w-4" /> : step.id}
              </div>
              <span
                className={clsx(
                  'mt-1 text-xs font-medium',
                  active ? 'text-primary-600' : 'text-gray-400',
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={clsx(
                  'w-16 h-0.5 mx-2 mb-5 transition-colors',
                  current > step.id ? 'bg-primary-600' : 'bg-gray-200',
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

function TriggerConfigPanel({
  triggerType,
  config,
  onChange,
}: {
  triggerType: AutomationTriggerType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  if (triggerType === 'TRIP_STATUS_CHANGED') {
    return (
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">From Status</label>
          <select
            value={(config.fromStatus as string) ?? ''}
            onChange={e => set('fromStatus', e.target.value)}
            className="form-input w-full"
          >
            <option value="">Any</option>
            {TRIP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">To Status</label>
          <select
            value={(config.toStatus as string) ?? ''}
            onChange={e => set('toStatus', e.target.value)}
            className="form-input w-full"
          >
            <option value="">Any</option>
            {TRIP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    );
  }

  if (triggerType === 'SCHEDULE_CRON') {
    return (
      <div className="mt-4 space-y-1">
        <label className="text-sm font-medium text-gray-700">Cron Expression</label>
        <input
          type="text"
          value={(config.cron as string) ?? ''}
          onChange={e => set('cron', e.target.value)}
          placeholder="0 9 * * 1 (every Monday at 9 AM)"
          className="form-input w-full"
        />
        <p className="text-xs text-gray-400">Standard cron syntax (UTC).</p>
      </div>
    );
  }

  if (triggerType === 'CONTACT_FIELD_UPDATED' || triggerType === 'TICKET_ESCALATED') {
    return (
      <div className="mt-4 space-y-1">
        <label className="text-sm font-medium text-gray-700">Field / Status filter (optional)</label>
        <input
          type="text"
          value={(config.filter as string) ?? ''}
          onChange={e => set('filter', e.target.value)}
          placeholder="e.g. preferredChannel or OPEN"
          className="form-input w-full"
        />
      </div>
    );
  }

  return null;
}

export function AutomationBuilder({ automationId, onSave, onCancel }: AutomationBuilderProps) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<AutomationTriggerType | ''>('');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [conditionGroups, setConditionGroups] = useState<ConditionGroup[]>([]);
  const [actions, setActions] = useState<AutomationAction[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [dryRunOpen, setDryRunOpen] = useState(false);
  const [savedId, setSavedId] = useState<string | undefined>(automationId);

  const { data: existing } = useAutomation(automationId ?? '');
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();

  // Pre-fill form from existing automation
  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description ?? '');
      const firstTrigger = existing.triggers[0];
      if (firstTrigger) {
        setTriggerType(firstTrigger.eventType);
        setTriggerConfig(firstTrigger.config ?? {});
      }
      setConditionGroups(
        existing.conditionGroups.map(g => ({
          id: g.id,
          operator: g.logicOperator,
          conditions: g.conditions.map(c => ({
            id: c.id,
            field: c.field,
            operator: c.operator,
            value: c.value ?? '',
          })),
        })),
      );
      setActions(
        existing.actions.map(a => ({
          id: a.id,
          order: a.order,
          type: a.type as AutomationAction['type'],
          config: a.config,
        })),
      );
      setIsEnabled(existing.isActive);
    }
  }, [existing]);

  async function handleSave() {
    if (!triggerType) return;

    const payload = {
      name: name || 'Untitled Automation',
      description: description || undefined,
      isActive: isEnabled,
      triggers: [{ eventType: triggerType, config: triggerConfig }],
      conditionGroups: conditionGroups.map(g => ({
        logicOperator: g.operator,
        conditions: g.conditions.map(c => ({
          field: c.field,
          operator: c.operator,
          value: c.value || undefined,
        })),
      })),
      actions: actions.map(a => ({
        type: a.type as import('@/api/automations.api').AutomationActionType,
        order: a.order,
        config: a.config,
      })),
    };

    let id = savedId;
    if (savedId) {
      await updateAutomation.mutateAsync({ id: savedId, data: payload });
    } else {
      const created = await createAutomation.mutateAsync(payload);
      id = created.id;
      setSavedId(created.id);
    }

    onSave();
  }

  const isSaving = createAutomation.isPending || updateAutomation.isPending;
  const saveError = createAutomation.error ?? updateAutomation.error;

  return (
    <div className="flex flex-col h-full">
      <StepIndicator current={step} steps={STEPS} />

      <div className="flex-1 overflow-y-auto px-1">
        {/* Step 1: Trigger */}
        {step === 1 && (
          <div className="space-y-6 max-w-xl mx-auto">
            <TriggerPicker
              value={triggerType}
              onChange={t => {
                setTriggerType(t);
                setTriggerConfig({});
              }}
            />
            {triggerType && (
              <TriggerConfigPanel
                triggerType={triggerType}
                config={triggerConfig}
                onChange={setTriggerConfig}
              />
            )}
          </div>
        )}

        {/* Step 2: Conditions */}
        {step === 2 && (
          <div className="max-w-2xl mx-auto">
            <ConditionBuilder
              conditionGroups={conditionGroups}
              onChange={setConditionGroups}
            />
          </div>
        )}

        {/* Step 3: Actions + metadata */}
        {step === 3 && (
          <div className="space-y-8 max-w-2xl mx-auto">
            {/* Name / description / toggle */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Automation Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. S01 — Booking Confirmation"
                  className="form-input w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What does this automation do?"
                  rows={2}
                  className="form-input w-full"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isEnabled}
                  onClick={() => setIsEnabled(v => !v)}
                  className={clsx(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                    isEnabled ? 'bg-primary-600' : 'bg-gray-300',
                  )}
                >
                  <span
                    className={clsx(
                      'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
                      isEnabled ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <ActionList actions={actions} onChange={setActions} />

            {saveError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                {saveError instanceof Error ? saveError.message : 'Save failed. Please try again.'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-200 pt-4 flex items-center justify-between gap-3 mt-6">
        <div className="flex items-center gap-2">
          {step > 1 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(s => (s - 1) as Step)}
            >
              Back
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {savedId && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDryRunOpen(true)}
            >
              Dry Run
            </Button>
          )}
          {step < 3 ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => setStep(s => (s + 1) as Step)}
              disabled={step === 1 && !triggerType}
            >
              Next
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              loading={isSaving}
              disabled={!triggerType || !name.trim()}
            >
              {savedId ? 'Update Automation' : 'Create Automation'}
            </Button>
          )}
        </div>
      </div>

      {savedId && (
        <DryRunModal
          automationId={savedId}
          isOpen={dryRunOpen}
          onClose={() => setDryRunOpen(false)}
        />
      )}
    </div>
  );
}

export default AutomationBuilder;

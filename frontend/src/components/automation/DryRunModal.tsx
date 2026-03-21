import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useDryRunAutomation, type DryRunResult } from '@/api/automations.api';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface DryRunModalProps {
  automationId: string;
  isOpen: boolean;
  onClose: () => void;
}

type EntityType = 'trip' | 'contact' | 'ticket' | 'quote';

const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'trip', label: 'Trip' },
  { value: 'contact', label: 'Contact' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'quote', label: 'Quote' },
];

function ConditionResultPanel({
  conditionResults,
  conditionsMet,
}: {
  conditionResults: DryRunResult['conditionResults'];
  conditionsMet: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-gray-800">Conditions</h4>
        {conditionsMet ? (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircleIcon className="h-4 w-4" />
            All passed
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
            <XCircleIcon className="h-4 w-4" />
            Not met
          </span>
        )}
      </div>

      {conditionResults.map(group => (
        <div key={group.groupId} className="border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Group</span>
            {group.result ? (
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
            ) : (
              <XCircleIcon className="h-4 w-4 text-red-500" />
            )}
          </div>
          <div className="space-y-1 pl-2">
            {group.conditions.map((cond, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                {cond.result ? (
                  <CheckCircleIcon className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <XCircleIcon className="h-3.5 w-3.5 text-red-500 shrink-0" />
                )}
                <span className="font-mono text-gray-600">{cond.field}</span>
                <span className="text-gray-400">{cond.operator}</span>
                <span className="font-mono text-gray-600">{String(cond.value ?? '—')}</span>
                <span className="text-gray-400">→ actual:</span>
                <span className="font-mono text-gray-700">{String(cond.actual ?? '—')}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {conditionResults.length === 0 && (
        <p className="text-xs text-gray-400 italic">No conditions configured — always runs.</p>
      )}
    </div>
  );
}

function ActionsResultPanel({
  actions,
}: {
  actions: DryRunResult['actionsToExecute'];
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-800">
        Actions that would execute ({actions.length})
      </h4>
      {actions.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No actions would execute.</p>
      ) : (
        <div className="space-y-2">
          {actions.map((action, idx) => (
            <div
              key={idx}
              className="border border-gray-200 rounded-lg p-3 bg-gray-50"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
                  {action.order}
                </span>
                <span className="text-xs font-semibold text-gray-700">{action.type}</span>
                <span className="ml-auto text-xs text-green-600 font-medium flex items-center gap-1">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  would-send
                </span>
              </div>
              {Object.keys(action.config).length > 0 && (
                <dl className="space-y-0.5 pl-7">
                  {Object.entries(action.config).map(([key, val]) => (
                    <div key={key} className="flex gap-2 text-xs">
                      <dt className="text-gray-400 shrink-0">{key}:</dt>
                      <dd className="font-mono text-gray-700 truncate">{String(val)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DryRunModal({ automationId, isOpen, onClose }: DryRunModalProps) {
  const [entityType, setEntityType] = useState<EntityType>('trip');
  const [entityId, setEntityId] = useState('');
  const [result, setResult] = useState<DryRunResult | null>(null);

  const dryRun = useDryRunAutomation();

  async function handleRun() {
    setResult(null);
    const res = await dryRun.mutateAsync({
      id: automationId,
      context: { entityType, entityId },
    });
    setResult(res);
  }

  function handleClose() {
    setResult(null);
    dryRun.reset();
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Dry Run — Simulation"
      size="xl"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleRun}
            loading={dryRun.isPending}
            disabled={!entityId.trim()}
          >
            Run Simulation
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
          Dry run simulates the automation without sending any messages or modifying data.
        </div>

        {/* Input form */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Entity Type</label>
            <select
              value={entityType}
              onChange={e => setEntityType(e.target.value as EntityType)}
              className="form-input w-full"
            >
              {ENTITY_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Entity ID</label>
            <input
              type="text"
              value={entityId}
              onChange={e => setEntityId(e.target.value)}
              placeholder="e.g. trip_abc123"
              className="form-input w-full"
            />
          </div>
        </div>

        {/* Error display */}
        {dryRun.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {dryRun.error instanceof Error
              ? dryRun.error.message
              : 'Simulation failed. Please try again.'}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Simulation Results</h3>
              {result.conditionsMet ? (
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                  Conditions Met
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">
                  Conditions Not Met — Skipped
                </span>
              )}
            </div>

            <ConditionResultPanel
              conditionResults={result.conditionResults}
              conditionsMet={result.conditionsMet}
            />

            {result.conditionsMet && (
              <ActionsResultPanel actions={result.actionsToExecute} />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default DryRunModal;

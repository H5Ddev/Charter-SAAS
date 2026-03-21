import { useState } from 'react';
import {
  useAutomations,
  useDeleteAutomation,
  useUpdateAutomation,
  type Automation,
} from '@/api/automations.api';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { AutomationBuilder } from '@/components/automation/AutomationBuilder';
import { ExecutionLogTable } from '@/components/automation/ExecutionLogTable';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ClipboardDocumentListIcon,
  BoltIcon,
  DocumentDuplicateIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

// Pre-built scenario templates S01–S08
const PREBUILT_TEMPLATES = [
  { id: 'S01', name: 'Booking Confirmation', trigger: 'TRIP_STATUS_CHANGED', description: 'Sends booking confirmation SMS + email when a trip is confirmed.' },
  { id: 'S02', name: '24-Hour Pre-Flight Reminder', trigger: 'SCHEDULED', description: 'Reminds passengers of departure details 24 hours before flight.' },
  { id: 'S03', name: '2-Hour Pre-Flight Reminder', trigger: 'SCHEDULED', description: 'Sends boarding time and FBO address 2 hours before departure.' },
  { id: 'S04', name: 'Departure Notification', trigger: 'TRIP_STATUS_CHANGED', description: 'Notifies passengers when the aircraft has departed.' },
  { id: 'S05', name: 'Delay Alert', trigger: 'TRIP_DELAY_FLAGGED', description: 'Sends delay alert to all passengers and ops team via Slack.' },
  { id: 'S06', name: 'Post-Flight Survey', trigger: 'TRIP_STATUS_CHANGED', description: 'Sends post-trip survey link after trip completion.' },
  { id: 'S07', name: 'Document Expiry Alert', trigger: 'SCHEDULED', description: 'Alerts ops team when pilot/aircraft documents are expiring.' },
  { id: 'S08', name: 'Quote Follow-Up', trigger: 'QUOTE_CREATED', description: 'Follows up on pending quotes 48 hours after creation.' },
];

const TRIGGER_BADGE: Record<string, BadgeVariant> = {
  CONTACT_CREATED: 'info',
  CONTACT_FIELD_UPDATED: 'info',
  TRIP_STATUS_CHANGED: 'primary',
  TRIP_DELAY_FLAGGED: 'warning',
  QUOTE_CREATED: 'purple',
  QUOTE_ACCEPTED: 'success',
  QUOTE_DECLINED: 'danger',
  QUOTE_EXPIRED: 'warning',
  TICKET_OPENED: 'warning',
  TICKET_STATUS_CHANGED: 'warning',
  PAYMENT_RECEIVED: 'success',
  DOCUMENT_SIGNED: 'success',
  SCHEDULED: 'default',
  MANUAL: 'default',
};

const TRIGGER_LABELS: Record<string, string> = {
  CONTACT_CREATED: 'Contact Created',
  CONTACT_FIELD_UPDATED: 'Field Updated',
  TRIP_STATUS_CHANGED: 'Trip Status',
  TRIP_DELAY_FLAGGED: 'Delay Flagged',
  QUOTE_CREATED: 'Quote Created',
  QUOTE_ACCEPTED: 'Quote Accepted',
  QUOTE_DECLINED: 'Quote Declined',
  QUOTE_EXPIRED: 'Quote Expired',
  TICKET_OPENED: 'Ticket Opened',
  TICKET_STATUS_CHANGED: 'Ticket Status',
  PAYMENT_RECEIVED: 'Payment',
  DOCUMENT_SIGNED: 'Doc Signed',
  SCHEDULED: 'Scheduled',
  MANUAL: 'Manual',
};

type StatusFilter = '' | 'active' | 'inactive';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function EnabledToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      disabled={disabled}
      className={clsx(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 disabled:opacity-50',
        value ? 'bg-primary-600' : 'bg-gray-300',
      )}
    >
      <span
        className={clsx(
          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform',
          value ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function AutomationCard({
  automation,
  onEdit,
  onLogs,
  onDelete,
  onToggle,
  togglePending,
}: {
  automation: Automation;
  onEdit: () => void;
  onLogs: () => void;
  onDelete: () => void;
  onToggle: () => void;
  togglePending: boolean;
}) {
  const trigger = automation.triggers[0];
  const eventType = trigger?.eventType ?? '';

  return (
    <div
      className={clsx(
        'bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4 transition-all',
        automation.isActive ? 'hover:border-gray-300' : 'opacity-75 hover:opacity-100',
      )}
    >
      {/* Top row: name + toggle */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <BoltIcon
              className={clsx(
                'h-4 w-4 shrink-0',
                automation.isActive ? 'text-primary-500' : 'text-gray-300',
              )}
            />
            <h3 className="text-sm font-semibold text-gray-900 truncate">{automation.name}</h3>
          </div>
          {automation.description && (
            <p className="text-xs text-gray-400 truncate pl-6">{automation.description}</p>
          )}
        </div>
        <EnabledToggle
          value={automation.isActive}
          onChange={onToggle}
          disabled={togglePending}
        />
      </div>

      {/* Trigger badge */}
      {eventType && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">Trigger</span>
          <Badge variant={TRIGGER_BADGE[eventType] ?? 'default'} size="sm">
            {TRIGGER_LABELS[eventType] ?? eventType}
          </Badge>
        </div>
      )}

      {/* Footer: last run + actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-400">
          {automation.lastExecutedAt ? (
            <>
              <span className="text-gray-500 font-medium">Last run</span>{' '}
              {formatDateTime(automation.lastExecutedAt)}
            </>
          ) : (
            <span className="italic">Never run</span>
          )}
          {automation.executionCount > 0 && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
              {automation.executionCount.toLocaleString()} runs
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onEdit}
            title="Edit"
            className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onLogs}
            title="View Logs"
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <ClipboardDocumentListIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [logsId, setLogsId] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Automation | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const { data, isLoading } = useAutomations({ page: 1, pageSize: 100 });
  const deleteAutomation = useDeleteAutomation();
  const updateAutomation = useUpdateAutomation();

  const allAutomations = data?.data ?? [];

  const automations = allAutomations.filter(a => {
    if (statusFilter === 'active') return a.isActive;
    if (statusFilter === 'inactive') return !a.isActive;
    return true;
  });

  const activeCount = allAutomations.filter(a => a.isActive).length;
  const inactiveCount = allAutomations.filter(a => !a.isActive).length;

  function openCreate() {
    setEditingId(undefined);
    setBuilderOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setBuilderOpen(true);
  }

  function handleBuilderSave() {
    setBuilderOpen(false);
    setEditingId(undefined);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteAutomation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function handleToggle(automation: Automation) {
    await updateAutomation.mutateAsync({
      id: automation.id,
      data: { isActive: !automation.isActive } as never,
    });
  }

  async function handleCloneTemplate(template: (typeof PREBUILT_TEMPLATES)[0]) {
    // Open builder pre-filled with template trigger
    setEditingId(undefined);
    setBuilderOpen(true);
    // Note: pre-filling would require query params or a state prop; the builder
    // handles fresh-create for now. A full implementation would pass initialValues.
  }

  const STATUS_FILTERS: { value: StatusFilter; label: string; count?: number }[] = [
    { value: '', label: 'All', count: allAutomations.length },
    { value: 'active', label: 'Active', count: activeCount },
    { value: 'inactive', label: 'Inactive', count: inactiveCount },
  ];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isLoading
              ? 'Loading…'
              : `${allAutomations.length} automation${allAutomations.length !== 1 ? 's' : ''} · ${activeCount} active`}
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <PlusIcon className="h-4 w-4 mr-1.5" />
          New Automation
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors shrink-0',
              statusFilter === f.value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
            )}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span
                className={clsx(
                  'inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-[10px] font-semibold',
                  statusFilter === f.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600',
                )}
              >
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Live automations list */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 h-44 animate-pulse" />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <BoltIcon className="h-6 w-6 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              {statusFilter ? 'No automations match this filter' : 'No automations yet'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {statusFilter
                ? 'Try a different filter above'
                : 'Create a custom automation or clone one of the pre-built templates below'}
            </p>
          </div>
          {!statusFilter && (
            <Button variant="primary" onClick={openCreate}>
              <PlusIcon className="h-4 w-4 mr-1.5" />
              New Automation
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {automations.map(auto => (
            <AutomationCard
              key={auto.id}
              automation={auto}
              onEdit={() => openEdit(auto.id)}
              onLogs={() => setLogsId(auto.id)}
              onDelete={() => setDeleteTarget(auto)}
              onToggle={() => handleToggle(auto)}
              togglePending={updateAutomation.isPending}
            />
          ))}
        </div>
      )}

      {/* Pre-built templates */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <SparklesIcon className="h-5 w-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Pre-built Templates</h2>
          <span className="ml-1 text-xs text-gray-400 font-normal">
            — clone any template to get started quickly
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PREBUILT_TEMPLATES.map(tmpl => (
            <div
              key={tmpl.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3 hover:border-gray-300 hover:shadow transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-mono font-semibold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded shrink-0">
                      {tmpl.id}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{tmpl.name}</h3>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed mt-1.5">{tmpl.description}</p>
                </div>
                <Badge variant={TRIGGER_BADGE[tmpl.trigger] ?? 'default'} size="sm">
                  {TRIGGER_LABELS[tmpl.trigger] ?? tmpl.trigger}
                </Badge>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => handleCloneTemplate(tmpl)}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  <DocumentDuplicateIcon className="h-3.5 w-3.5" />
                  Clone template
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Builder slide-over modal */}
      <Modal
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        title={editingId ? 'Edit Automation' : 'New Automation'}
        size="full"
      >
        <AutomationBuilder
          automationId={editingId}
          onSave={handleBuilderSave}
          onCancel={() => setBuilderOpen(false)}
        />
      </Modal>

      {/* Execution logs modal */}
      <Modal
        isOpen={!!logsId}
        onClose={() => setLogsId(undefined)}
        title="Execution Logs"
        size="full"
      >
        {logsId && <ExecutionLogTable automationId={logsId} />}
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Automation"
        size="sm"
        footer={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleteAutomation.isPending}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-700">
          Are you sure you want to delete{' '}
          <span className="font-semibold">{deleteTarget?.name}</span>? This action cannot be
          undone and all execution history will be lost.
        </p>
      </Modal>
    </div>
  );
}

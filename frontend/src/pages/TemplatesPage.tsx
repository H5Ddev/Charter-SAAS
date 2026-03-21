import { useState, type ReactNode } from 'react';
import {
  useNotificationTemplates,
  type NotificationTemplate,
  type NotificationChannel,
} from '@/api/notifications.api';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { TemplateEditor } from '@/components/notifications/TemplateEditor';
import { TemplatePreview } from '@/components/notifications/TemplatePreview';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  EyeIcon,
  EnvelopeIcon,
  ChatBubbleLeftEllipsisIcon,
  BellIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

const CHANNELS: NotificationChannel[] = ['SMS', 'EMAIL', 'WHATSAPP', 'SLACK', 'TEAMS', 'IN_APP'];

const CHANNEL_BADGE: Record<NotificationChannel, BadgeVariant> = {
  SMS: 'primary',
  EMAIL: 'info',
  WHATSAPP: 'success',
  SLACK: 'purple',
  TEAMS: 'warning',
  IN_APP: 'default',
};

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  SMS: 'SMS',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  SLACK: 'Slack',
  TEAMS: 'Teams',
  IN_APP: 'In-App',
};

// Channel icons for card decoration
const CHANNEL_ICON: Record<NotificationChannel, ReactNode> = {
  SMS: <ChatBubbleLeftEllipsisIcon className="h-4 w-4" />,
  EMAIL: <EnvelopeIcon className="h-4 w-4" />,
  WHATSAPP: <ChatBubbleLeftEllipsisIcon className="h-4 w-4" />,
  SLACK: <ChatBubbleLeftEllipsisIcon className="h-4 w-4" />,
  TEAMS: <ChatBubbleLeftEllipsisIcon className="h-4 w-4" />,
  IN_APP: <BellIcon className="h-4 w-4" />,
};

// Subtle background tint per channel for the card's icon area
const CHANNEL_ICON_BG: Record<NotificationChannel, string> = {
  SMS: 'bg-primary-50 text-primary-600',
  EMAIL: 'bg-blue-50 text-blue-600',
  WHATSAPP: 'bg-green-50 text-green-600',
  SLACK: 'bg-purple-50 text-purple-600',
  TEAMS: 'bg-amber-50 text-amber-600',
  IN_APP: 'bg-gray-100 text-gray-500',
};

function TemplateCard({
  template,
  onEdit,
  onPreview,
}: {
  template: NotificationTemplate;
  onEdit: () => void;
  onPreview: () => void;
}) {
  const hasSubject = !!template.subject;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow transition-all flex flex-col">
      {/* Card header */}
      <div className="px-5 pt-5 pb-4 flex items-start gap-3">
        {/* Channel icon */}
        <div
          className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
            CHANNEL_ICON_BG[template.channel],
          )}
        >
          {CHANNEL_ICON[template.channel]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 leading-snug truncate">
              {template.name}
            </h3>
            <Badge variant={CHANNEL_BADGE[template.channel]} size="sm">
              {CHANNEL_LABEL[template.channel]}
            </Badge>
          </div>
          {hasSubject && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              <span className="font-medium text-gray-400">Subject: </span>
              {template.subject}
            </p>
          )}
        </div>
      </div>

      {/* Body preview */}
      <div className="mx-5 mb-4 flex-1">
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          {template.body ? (
            <p className="text-xs text-gray-600 font-mono leading-relaxed line-clamp-3">
              {template.body}
            </p>
          ) : (
            <p className="text-xs text-gray-300 italic">No content</p>
          )}
        </div>
      </div>

      {/* Variable count + system badge */}
      {(template.variables.length > 0 || template.isSystem) && (
        <div className="mx-5 mb-3 flex items-center gap-2 flex-wrap">
          {template.variables.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              <span className="font-mono">{'{{}}'}</span>
              {template.variables.length} variable{template.variables.length !== 1 ? 's' : ''}
            </span>
          )}
          {template.isSystem && (
            <span className="inline-flex items-center text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              System template
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors border border-gray-200 hover:border-gray-300"
        >
          <EyeIcon className="h-3.5 w-3.5" />
          Preview
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg px-3 py-2 transition-colors border border-primary-200 hover:border-primary-300"
        >
          <PencilSquareIcon className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [channelFilter, setChannelFilter] = useState<NotificationChannel | ''>('');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null);

  const { data, isLoading } = useNotificationTemplates({
    channel: channelFilter || undefined,
    search: search || undefined,
    pageSize: 100,
  });

  const templates = data?.data ?? [];
  const total = data?.meta?.total ?? templates.length;

  function openCreate() {
    setEditingId(undefined);
    setEditorOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setEditorOpen(true);
  }

  function handleEditorSave() {
    setEditorOpen(false);
    setEditingId(undefined);
  }

  const hasFilters = !!channelFilter || !!search;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isLoading
              ? 'Loading…'
              : `${total} template${total !== 1 ? 's' : ''} across ${CHANNELS.length} channels`}
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <PlusIcon className="h-4 w-4 mr-1.5" />
          New Template
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[200px] max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search templates…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input pl-9 w-full text-sm"
          />
        </div>

        {/* Channel pill filters */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            type="button"
            onClick={() => setChannelFilter('')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors shrink-0',
              !channelFilter
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
            )}
          >
            All channels
          </button>
          {CHANNELS.map(ch => (
            <button
              key={ch}
              type="button"
              onClick={() => setChannelFilter(ch === channelFilter ? '' : ch)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors shrink-0',
                channelFilter === ch
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
              )}
            >
              {CHANNEL_LABEL[ch]}
            </button>
          ))}
        </div>
      </div>

      {/* Template grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm h-52 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <EnvelopeIcon className="h-6 w-6 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              {hasFilters ? 'No templates match your filters' : 'No templates yet'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {hasFilters
                ? 'Try clearing your search or changing the channel filter'
                : 'Create reusable message templates for all your channels'}
            </p>
          </div>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => { setChannelFilter(''); setSearch(''); }}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Clear filters
            </button>
          ) : (
            <Button variant="primary" onClick={openCreate}>
              <PlusIcon className="h-4 w-4 mr-1.5" />
              New Template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(tmpl => (
            <TemplateCard
              key={tmpl.id}
              template={tmpl}
              onEdit={() => openEdit(tmpl.id)}
              onPreview={() => setPreviewTemplate(tmpl)}
            />
          ))}
        </div>
      )}

      {/* Editor modal */}
      <Modal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? 'Edit Template' : 'New Template'}
        size="full"
      >
        <TemplateEditor
          templateId={editingId}
          onSave={handleEditorSave}
          onCancel={() => setEditorOpen(false)}
        />
      </Modal>

      {/* Preview modal */}
      <Modal
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        title={`Preview — ${previewTemplate?.name ?? ''}`}
        size="lg"
      >
        {previewTemplate && (
          <TemplatePreview
            channel={previewTemplate.channel}
            subject={previewTemplate.subject ?? undefined}
            body={previewTemplate.body}
          />
        )}
      </Modal>
    </div>
  );
}

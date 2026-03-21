import { useState, useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import {
  useNotificationTemplate,
  useCreateTemplate,
  useUpdateTemplate,
  type NotificationChannel,
} from '@/api/notifications.api';
import { VariablePicker } from '@/components/automation/VariablePicker';
import { TemplatePreview } from './TemplatePreview';
import { clsx } from 'clsx';

interface TemplateEditorProps {
  templateId?: string;
  onSave: () => void;
  onCancel: () => void;
}

const CHANNELS: NotificationChannel[] = ['SMS', 'EMAIL', 'WHATSAPP', 'SLACK', 'TEAMS', 'IN_APP'];

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  SMS: 'SMS',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  SLACK: 'Slack',
  TEAMS: 'Teams',
  IN_APP: 'In-App',
};

function smsSegmentCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 160);
}

export function TemplateEditor({ templateId, onSave, onCancel }: TemplateEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [channel, setChannel] = useState<NotificationChannel>('SMS');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const { data: existing } = useNotificationTemplate(templateId ?? '');
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription('');
      setChannel(existing.channel);
      setSubject(existing.subject ?? '');
      setBody(existing.body);
    }
  }, [existing]);

  function insertVariable(variable: string) {
    const el = bodyRef.current;
    if (!el) {
      setBody(b => b + variable);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newBody = body.slice(0, start) + variable + body.slice(end);
    setBody(newBody);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + variable.length;
      el.focus();
    });
  }

  async function handleSave() {
    const payload = {
      name,
      channel,
      body,
      subject: channel === 'EMAIL' ? subject : undefined,
    };

    if (templateId) {
      await updateTemplate.mutateAsync({ id: templateId, data: payload });
    } else {
      await createTemplate.mutateAsync(payload);
    }
    onSave();
  }

  const isSaving = createTemplate.isPending || updateTemplate.isPending;
  const saveError = createTemplate.error ?? updateTemplate.error;
  const isValid = name.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Split-pane layout */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Left: form */}
        <div className="flex-1 space-y-4 overflow-y-auto">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Booking Confirmation SMS"
              className="form-input w-full"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description for this template"
              rows={2}
              className="form-input w-full"
            />
          </div>

          {/* Channel selector */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Channel</label>
            <div className="flex flex-wrap gap-1">
              {CHANNELS.map(ch => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => {
                    setChannel(ch);
                    if (ch !== 'EMAIL') setSubject('');
                  }}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-md border font-medium transition-colors',
                    channel === ch
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {CHANNEL_LABELS[ch]}
                </button>
              ))}
            </div>
          </div>

          {/* Subject (email only) */}
          {channel === 'EMAIL' && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Your upcoming flight on {{trip.departureDate}}"
                className="form-input w-full"
              />
            </div>
          )}

          {/* Body */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Body <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                {channel === 'SMS' && body.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {body.length} chars · {smsSegmentCount(body)} segment
                    {smsSegmentCount(body) !== 1 ? 's' : ''}
                  </span>
                )}
                <VariablePicker onSelect={insertVariable} />
              </div>
            </div>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={`Hi {{passenger.firstName}}, your flight departs on {{trip.departureDate}} at {{trip.departureTime}}.`}
              rows={8}
              className="form-input w-full font-mono text-sm resize-y"
            />
            {channel === 'SMS' && (
              <p className="text-xs text-gray-400">
                160 characters per SMS segment. Long messages may be split.
              </p>
            )}
          </div>

          {saveError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              {saveError instanceof Error ? saveError.message : 'Save failed. Please try again.'}
            </div>
          )}
        </div>

        {/* Right: preview */}
        <div className="lg:w-96 shrink-0 overflow-y-auto">
          <div className="sticky top-0">
            <TemplatePreview channel={channel} subject={subject} body={body} />
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-gray-200 pt-4 mt-4 flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={isSaving}
          disabled={!isValid}
        >
          {templateId ? 'Update Template' : 'Create Template'}
        </Button>
      </div>
    </div>
  );
}

export default TemplateEditor;

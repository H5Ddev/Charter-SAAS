import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { useAuthStore } from '@/store/auth.store'
import { apiClient } from '@/api/client'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  SignalIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

// ---------- Schemas ----------

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email'),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(12, 'Password must be at least 12 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

// ---------- Types ----------

type ActiveTab = 'profile' | 'security' | 'notifications' | 'integrations'

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'integrations', label: 'Integrations' },
]

interface IntegrationStatus {
  twilio: {
    configured: boolean
    phoneNumber: string | null
    whatsappFrom: string | null
    inboundWebhookUrl: string
  }
  sendgrid: {
    configured: boolean
    fromEmail: string | null
    fromName: string
  }
}

// ---------- Copy button ----------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <CheckIcon className="h-4 w-4 text-green-500" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
    </button>
  )
}

// ---------- Status badge ----------

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
      configured ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800',
    )}>
      {configured
        ? <><SignalIcon className="h-3.5 w-3.5" />Connected</>
        : <><ExclamationTriangleIcon className="h-3.5 w-3.5" />Not configured</>}
    </span>
  )
}

// ---------- Integrations Tab ----------

function IntegrationsTab() {
  const [testPhone, setTestPhone] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const { data: status, isLoading } = useQuery({
    queryKey: ['integrations-status'],
    queryFn: async () => {
      const res = await apiClient.get<IntegrationStatus>('/integrations/status')
      return res.data as IntegrationStatus
    },
  })

  const testSms = useMutation({
    mutationFn: async (to: string) => {
      const res = await apiClient.post<{ sent: boolean; to: string }>('/integrations/twilio/test', { to })
      return res.data as { sent: boolean; to: string }
    },
    onSuccess: (data) => {
      setTestResult({ ok: true, message: `Test SMS sent to ${data.to}` })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setTestResult({ ok: false, message: msg ?? 'Failed to send test SMS.' })
    },
  })

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Loading integration status…</div>
  }

  return (
    <div className="space-y-6">

      {/* ── Twilio ── */}
      <div className="card p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Twilio — SMS &amp; WhatsApp</h2>
            <p className="text-sm text-gray-500 mt-0.5">Outbound SMS, WhatsApp, and inbound SMS-to-ticket.</p>
          </div>
          <StatusBadge configured={status?.twilio.configured ?? false} />
        </div>

        {/* Config instructions */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-3 text-sm">
          <p className="font-medium text-gray-700">Azure App Service — Application Settings</p>
          <p className="text-gray-500 text-xs">Add these environment variables in the Azure Portal under your backend App Service → Settings → Environment variables.</p>
          {[
            { key: 'TWILIO_ACCOUNT_SID', hint: 'From Twilio Console → Account Info' },
            { key: 'TWILIO_AUTH_TOKEN', hint: 'From Twilio Console → Account Info' },
            { key: 'TWILIO_PHONE_NUMBER', hint: 'E.164 format, e.g. +15550001234' },
            { key: 'TWILIO_WHATSAPP_FROM', hint: 'Optional — WhatsApp sender (e.g. whatsapp:+14155238886)' },
          ].map(({ key, hint }) => (
            <div key={key}>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-800 flex-1">{key}</code>
                <CopyButton text={key} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5 pl-0.5">{hint}</p>
            </div>
          ))}
        </div>

        {/* Inbound webhook URL */}
        {status?.twilio.inboundWebhookUrl && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-2">
            <p className="text-sm font-medium text-blue-800">Twilio Console — Inbound SMS Webhook</p>
            <p className="text-xs text-blue-600">In Twilio Console → Phone Numbers → Your number → Messaging → Webhook URL (HTTP POST):</p>
            <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-md px-3 py-2">
              <code className="font-mono text-xs text-gray-800 flex-1 break-all">{status.twilio.inboundWebhookUrl}</code>
              <CopyButton text={status.twilio.inboundWebhookUrl} />
            </div>
            <p className="text-xs text-blue-600">Inbound SMS messages will create tickets automatically and can trigger auto-reply templates.</p>
          </div>
        )}

        {/* Current config info */}
        {status?.twilio.configured && (
          <div className="text-sm text-gray-600 space-y-1">
            {status.twilio.phoneNumber && <p><span className="text-gray-400">SMS from:</span> <span className="font-mono">{status.twilio.phoneNumber}</span></p>}
            {status.twilio.whatsappFrom && <p><span className="text-gray-400">WhatsApp from:</span> <span className="font-mono">{status.twilio.whatsappFrom}</span></p>}
          </div>
        )}

        {/* Test SMS */}
        <div className="pt-2 border-t border-gray-100 space-y-3">
          <p className="text-sm font-medium text-gray-700">Send a test SMS</p>
          <div className="flex items-center gap-3">
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+15550001234"
              disabled={!status?.twilio.configured}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400 font-mono"
            />
            <Button
              size="sm"
              disabled={!status?.twilio.configured || !testPhone.trim() || testSms.isPending}
              onClick={() => {
                setTestResult(null)
                testSms.mutate(testPhone.trim())
              }}
            >
              {testSms.isPending ? 'Sending…' : 'Send Test'}
            </Button>
          </div>
          {!status?.twilio.configured && (
            <p className="text-xs text-amber-600">Configure Twilio credentials in Azure first.</p>
          )}
          {testResult && (
            <p className={clsx('text-sm rounded-lg px-3 py-2', testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
              {testResult.message}
            </p>
          )}
        </div>
      </div>

      {/* ── SendGrid ── */}
      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">SendGrid — Email</h2>
            <p className="text-sm text-gray-500 mt-0.5">Transactional email for quotes, confirmations, and notifications.</p>
          </div>
          <StatusBadge configured={status?.sendgrid.configured ?? false} />
        </div>

        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-3 text-sm">
          <p className="font-medium text-gray-700">Azure App Service — Application Settings</p>
          {[
            { key: 'SENDGRID_API_KEY', hint: 'From SendGrid → Settings → API Keys' },
            { key: 'SENDGRID_FROM_EMAIL', hint: 'Verified sender address, e.g. ops@yourdomain.com' },
            { key: 'SENDGRID_FROM_NAME', hint: 'Display name, e.g. AeroComm Ops' },
          ].map(({ key, hint }) => (
            <div key={key}>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-800 flex-1">{key}</code>
                <CopyButton text={key} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5 pl-0.5">{hint}</p>
            </div>
          ))}
        </div>

        {status?.sendgrid.configured && (
          <p className="text-sm text-gray-600">
            <span className="text-gray-400">Sending from:</span>{' '}
            <span className="font-mono">{status.sendgrid.fromEmail}</span>
            {status.sendgrid.fromName && <span className="text-gray-400"> ({status.sendgrid.fromName})</span>}
          </p>
        )}
      </div>

    </div>
  )
}

// ---------- Main Page ----------

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState<ActiveTab>('profile')
  const [profileSaved, setProfileSaved] = useState(false)

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
    },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  })

  async function onProfileSubmit(values: ProfileForm) {
    // TODO: wire to PATCH /api/users/me
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 3000)
  }

  async function onPasswordSubmit(values: PasswordForm) {
    // TODO: wire to POST /api/auth/change-password
    passwordForm.reset()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={
                activeTab === tab.id
                  ? 'border-b-2 border-primary-600 pb-3 text-sm font-semibold text-primary-600'
                  : 'pb-3 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300 transition-colors'
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card p-6 space-y-6">
          <h2 className="text-base font-semibold text-gray-900">Profile Information</h2>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                required
                error={profileForm.formState.errors.firstName?.message}
                {...profileForm.register('firstName')}
              />
              <Input
                label="Last Name"
                required
                error={profileForm.formState.errors.lastName?.message}
                {...profileForm.register('lastName')}
              />
            </div>
            <Input
              label="Email"
              type="email"
              required
              error={profileForm.formState.errors.email?.message}
              {...profileForm.register('email')}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" loading={profileForm.formState.isSubmitting}>
                Save Changes
              </Button>
              {profileSaved && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircleIcon className="h-4 w-4" />
                  Saved!
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Change Password</h2>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4" noValidate>
              <Input
                label="Current Password"
                type="password"
                required
                error={passwordForm.formState.errors.currentPassword?.message}
                {...passwordForm.register('currentPassword')}
              />
              <Input
                label="New Password"
                type="password"
                required
                helperText="Minimum 12 characters"
                error={passwordForm.formState.errors.newPassword?.message}
                {...passwordForm.register('newPassword')}
              />
              <Input
                label="Confirm New Password"
                type="password"
                required
                error={passwordForm.formState.errors.confirmPassword?.message}
                {...passwordForm.register('confirmPassword')}
              />
              <Button type="submit" loading={passwordForm.formState.isSubmitting}>
                Update Password
              </Button>
            </form>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Two-Factor Authentication</h2>
            <p className="text-sm text-gray-600">
              Add an extra layer of security to your account by enabling TOTP-based two-factor authentication.
            </p>
            <Button variant="secondary">Set up 2FA</Button>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="card p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Notification Preferences</h2>
          <p className="text-sm text-gray-500">
            Configure which events send you in-app notifications.
          </p>
          <div className="space-y-3">
            {[
              { label: 'New ticket assigned to me', key: 'ticketAssigned' },
              { label: 'Trip status changes', key: 'tripStatus' },
              { label: 'Quote accepted or declined', key: 'quoteStatus' },
              { label: 'Automation execution failures', key: 'automationFailure' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </label>
            ))}
          </div>
          <Button className="mt-2">Save Preferences</Button>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && <IntegrationsTab />}
    </div>
  )
}

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '@/store/auth.store'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { CheckCircleIcon } from '@heroicons/react/24/outline'

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

type ActiveTab = 'profile' | 'security' | 'notifications'

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'notifications', label: 'Notifications' },
]

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
    console.log('Profile update:', values)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 3000)
  }

  async function onPasswordSubmit(values: PasswordForm) {
    // TODO: wire to POST /api/auth/change-password
    console.log('Password change:', values)
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
              Add an extra layer of security to your account by enabling TOTP-based two-factor
              authentication.
            </p>
            <Button variant="secondary">
              Set up 2FA
            </Button>
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
    </div>
  )
}

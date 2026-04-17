import { useEffect, useState } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useMfaDisable } from '@/api/auth.api'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function MfaDisableModal({ isOpen, onClose }: Props) {
  const disable = useMfaDisable()
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setPassword('')
      setToken('')
      setError(null)
    }
  }, [isOpen])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || !/^\d{6}$/.test(token)) {
      setError('Enter your current password and a 6-digit code from your authenticator app')
      return
    }
    setError(null)
    try {
      await disable.mutateAsync({ password, token })
      onClose()
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setError(msg ?? 'Failed to disable 2FA. Check your password and code.')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Disable two-factor authentication" size="md">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p>
            Disabling 2FA reduces your account security. Anyone with your password will be able to
            sign in without a second factor.
          </p>
        </div>

        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Input
          label="Authenticator code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
          helperText="Enter the current 6-digit code from your authenticator app"
          required
        />

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button
            variant="danger"
            type="submit"
            loading={disable.isPending}
            disabled={!password || token.length !== 6}
          >
            Disable 2FA
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default MfaDisableModal

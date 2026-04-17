import { useEffect, useState } from 'react'
import { CheckCircleIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useMfaSetup, useMfaSetupVerify } from '@/api/auth.api'

interface Props {
  isOpen: boolean
  onClose: () => void
}

type Phase = 'scanning' | 'success'

export function MfaSetupModal({ isOpen, onClose }: Props) {
  const setup = useMfaSetup()
  const verify = useMfaSetupVerify()
  const [phase, setPhase] = useState<Phase>('scanning')
  const [token, setToken] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch QR code + secret once the modal opens
  useEffect(() => {
    if (!isOpen) return
    setPhase('scanning')
    setToken('')
    setError(null)
    setup.mutate()
    // Intentionally run only on open; setup is a stable mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  function handleCopySecret() {
    if (!setup.data?.secret) return
    void navigator.clipboard.writeText(setup.data.secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleVerify() {
    if (!/^\d{6}$/.test(token)) {
      setError('Enter the 6-digit code from your authenticator app')
      return
    }
    setError(null)
    try {
      await verify.mutateAsync(token)
      setPhase('success')
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setError(msg ?? 'Verification failed. Try again.')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={phase === 'success' ? 'Two-factor authentication enabled' : 'Set up two-factor authentication'}
      size="md"
    >
      {phase === 'success' ? (
        <div className="flex flex-col items-center py-4 space-y-4">
          <CheckCircleIcon className="h-14 w-14 text-green-500" />
          <p className="text-center text-sm text-gray-600">
            Two-factor authentication is now active on your account. You'll be asked for a code
            from your authenticator app the next time you sign in.
          </p>
          <Button variant="primary" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="space-y-5">
          <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-600">
            <li>Open an authenticator app (1Password, Google Authenticator, Authy, etc.)</li>
            <li>Scan the QR code below or enter the secret key manually</li>
            <li>Enter the 6-digit code from your app to finish setup</li>
          </ol>

          {setup.isPending && (
            <div className="text-sm text-gray-400 text-center py-8">Generating secret…</div>
          )}

          {setup.isError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              Failed to start setup. Close and try again.
            </div>
          )}

          {setup.data && (
            <>
              <div className="flex justify-center">
                <img
                  src={setup.data.qrCodeDataUrl}
                  alt="TOTP QR code"
                  className="h-44 w-44 rounded-md border border-gray-200 bg-white p-2"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Secret key</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                  <code className="font-mono text-xs text-gray-800 flex-1 break-all">
                    {setup.data.secret}
                  </code>
                  <button
                    onClick={handleCopySecret}
                    className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    title="Copy secret"
                    type="button"
                  >
                    {copied ? (
                      <CheckIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <ClipboardDocumentIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <Input
                  label="Authenticator code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  error={error ?? undefined}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                <Button
                  variant="primary"
                  onClick={handleVerify}
                  loading={verify.isPending}
                  disabled={token.length !== 6}
                  type="button"
                >
                  Enable 2FA
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

export default MfaSetupModal

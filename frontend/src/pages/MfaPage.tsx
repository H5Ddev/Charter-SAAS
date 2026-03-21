import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMfaVerify } from '@/api/auth.api'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

const mfaSchema = z.object({
  code: z
    .string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d+$/, 'Code must contain only digits'),
})

type MfaForm = z.infer<typeof mfaSchema>

interface LocationState {
  tempToken?: string
}

export default function MfaPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null
  const mfaVerify = useMfaVerify()

  // If no temp token, redirect to login
  useEffect(() => {
    if (!state?.tempToken) {
      navigate('/login', { replace: true })
    }
  }, [state, navigate])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MfaForm>({ resolver: zodResolver(mfaSchema) })

  async function onSubmit(values: MfaForm) {
    try {
      await mfaVerify.mutateAsync({
        tempToken: state!.tempToken!,
        code: values.code,
      })
      navigate('/dashboard', { replace: true })
    } catch {
      setError('code', { message: 'Invalid or expired code. Please try again.' })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary-700">AeroComm</h1>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Two-factor authentication</h2>
          <p className="text-sm text-gray-500 mb-6">
            Enter the 6-digit code from your authenticator app to continue.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label="Authentication code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              error={errors.code?.message}
              placeholder="000000"
              {...register('code')}
            />

            <Button type="submit" fullWidth loading={isSubmitting}>
              Verify
            </Button>

            <Button
              type="button"
              variant="ghost"
              fullWidth
              onClick={() => navigate('/login')}
            >
              Back to sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

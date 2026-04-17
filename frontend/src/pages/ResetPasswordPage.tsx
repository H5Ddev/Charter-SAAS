import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { useConfirmPasswordReset } from '../api/auth.api'
import { InlineLogoDark } from '../components/ui/AeroCommLogo'

const schema = z
  .object({
    newPassword: z.string().min(12, 'Password must be at least 12 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type Form = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [done, setDone] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const confirm = useConfirmPasswordReset()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  if (!token) {
    return <Navigate to="/forgot-password" replace />
  }

  async function onSubmit(values: Form) {
    setServerError(null)
    try {
      await confirm.mutateAsync({ token, newPassword: values.newPassword })
      setDone(true)
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setServerError(msg ?? 'Could not reset your password. The link may be expired.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <InlineLogoDark size={30} />
        </div>

        {done ? (
          <div className="flex flex-col items-center text-center space-y-4">
            <CheckCircleIcon className="h-12 w-12 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-900">Password updated</h2>
            <p className="text-sm text-gray-600">
              You've been signed out of every device. Sign in with your new password to continue.
            </p>
            <Link
              to="/login"
              className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2"
            >
              Go to sign-in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Set a new password</h2>
              <p className="mt-1 text-sm text-gray-500">
                Choose a new password for your account. It must be at least 12 characters.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  New password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  className={[
                    'block w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 outline-none',
                    'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                    errors.newPassword
                      ? 'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400'
                      : 'border-gray-300 bg-white hover:border-gray-400',
                  ].join(' ')}
                  {...register('newPassword')}
                />
                {errors.newPassword && (
                  <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className={[
                    'block w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 outline-none',
                    'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                    errors.confirmPassword
                      ? 'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400'
                      : 'border-gray-300 bg-white hover:border-gray-400',
                  ].join(' ')}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>

              {serverError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-3 text-sm text-red-700">
                  {serverError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={[
                  'w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white',
                  isSubmitting
                    ? 'bg-primary-400 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-700 shadow-sm',
                ].join(' ')}
              >
                {isSubmitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

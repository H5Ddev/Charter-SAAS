import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { useRequestPasswordReset } from '../api/auth.api'
import { InlineLogoDark } from '../components/ui/AeroCommLogo'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type Form = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const requestReset = useRequestPasswordReset()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  async function onSubmit(values: Form) {
    const tenantId =
      (import.meta.env.VITE_TENANT_ID as string | undefined) ||
      (() => {
        const parts = window.location.hostname.split('.')
        if (parts.length > 2) return parts[0]
        if (window.location.hostname === 'localhost') return 'tenant_aerocomm_demo'
        return 'default'
      })()
    await requestReset.mutateAsync({ tenantId, email: values.email })
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <InlineLogoDark size={30} />
        </div>

        {sent ? (
          <div className="flex flex-col items-center text-center space-y-4">
            <CheckCircleIcon className="h-12 w-12 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-900">Check your inbox</h2>
            <p className="text-sm text-gray-600">
              If an account exists for that email address, we've sent a link to reset your
              password. The link expires in 60 minutes.
            </p>
            <Link
              to="/login"
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Back to sign-in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Forgot your password?</h2>
              <p className="mt-1 text-sm text-gray-500">
                Enter the email associated with your account and we'll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className={[
                    'block w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900',
                    'placeholder:text-gray-400 outline-none',
                    'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                    errors.email
                      ? 'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400'
                      : 'border-gray-300 bg-white hover:border-gray-400',
                  ].join(' ')}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

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
                {isSubmitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Remembered it?{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
                Back to sign-in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

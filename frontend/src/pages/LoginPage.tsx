import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '../store/auth.store'
import { useLogin } from '../api/auth.api'
import { LoginPanelLogo, InlineLogoDark } from '../components/ui/AeroCommLogo'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const login = useLogin()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  async function onSubmit(values: LoginForm) {
    try {
      // Use build-time tenant ID, then subdomain, then 'default'
      const tenantId =
        (import.meta.env.VITE_TENANT_ID as string | undefined) ||
        (() => {
          const parts = window.location.hostname.split('.')
          if (parts.length > 2) return parts[0]
          if (window.location.hostname === 'localhost') return 'tenant_aerocomm_demo'
          return 'default'
        })()
      const result = await login.mutateAsync({ ...values, tenantId })
      if ('mfaRequired' in result && result.mfaRequired) {
        navigate('/auth/mfa', { state: { mfaSessionToken: (result as { mfaSessionToken: string }).mfaSessionToken } })
      }
    } catch {
      setError('root', { message: 'Invalid email or password.' })
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — branding ────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col relative overflow-hidden"
           style={{ background: 'linear-gradient(145deg, #0f172a 0%, #1e3a8f 60%, #1d4ed8 100%)' }}>

        {/* Grid texture overlay */}
        <div className="absolute inset-0 opacity-10"
             style={{
               backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
               backgroundSize: '40px 40px',
             }} />

        {/* Glow orbs */}
        <div className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full opacity-20"
             style={{ background: 'radial-gradient(circle, #60a5fa, transparent 70%)' }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-96 h-96 rounded-full opacity-15"
             style={{ background: 'radial-gradient(circle, #38bdf8, transparent 70%)' }} />

        {/* Watermark airplane */}
        <div className="absolute inset-0 flex items-center justify-end pr-8 pointer-events-none select-none">
          <svg viewBox="0 0 100 100" className="w-[70%] max-w-[480px] opacity-[0.06]" fill="white" xmlns="http://www.w3.org/2000/svg">
            {/* Wide-body commercial airplane, top-down view */}
            <path d="M50 2 C46 2 43 5 43 10 L43 38 L10 58 L10 66 L43 56 L43 72 L32 78 L32 84 L50 80 L68 84 L68 78 L57 72 L57 56 L90 66 L90 58 L57 38 L57 10 C57 5 54 2 50 2 Z" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col h-full p-12">

          {/* Logo */}
          <LoginPanelLogo />

          {/* Main copy */}
          <div className="flex-1 flex flex-col justify-center max-w-md">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-6 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-white/80 font-medium">Aviation Charter CRM</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Manage every<br />
              <span style={{ color: '#93c5fd' }}>flight, passenger</span><br />
              and conversation.
            </h1>
            <p className="text-white/60 text-lg leading-relaxed">
              From inquiry to post-flight survey — AeroComm handles the
              communications so your team stays focused on the sky.
            </p>
          </div>

          {/* Feature list */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '✈️', label: 'Trip & PAX management' },
              { icon: '💬', label: 'SMS, WhatsApp & Email' },
              { icon: '⚡', label: 'No-code automations' },
              { icon: '📊', label: 'Sales & quoting pipeline' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
                <span className="text-base">{f.icon}</span>
                <span className="text-xs text-white/70 font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-white">

        {/* Mobile logo */}
        <div className="lg:hidden mb-10">
          <InlineLogoDark size={30} />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="mt-1 text-sm text-gray-500">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

            {/* Email */}
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
                  'placeholder:text-gray-400 transition-all duration-150 outline-none',
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

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className={[
                  'block w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900',
                  'placeholder:text-gray-400 transition-all duration-150 outline-none',
                  'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                  errors.password
                    ? 'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400'
                    : 'border-gray-300 bg-white hover:border-gray-400',
                ].join(' ')}
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Root error */}
            {errors.root && (
              <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3" role="alert">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700">{errors.root.message}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={[
                'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white',
                'transition-all duration-150 mt-2',
                isSubmitting
                  ? 'bg-primary-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 active:scale-[0.98] shadow-sm hover:shadow',
              ].join(' ')}
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-gray-400">or continue with</span>
            </div>
          </div>

          {/* SSO button */}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-150 shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google / Azure AD
          </button>

          <p className="mt-8 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} H5 Enterprises · All rights reserved
          </p>
        </div>
      </div>

    </div>
  )
}

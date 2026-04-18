import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, Component, type ReactNode } from 'react'
import { Layout } from './components/layout/Layout'
import { ToastContainer } from './components/ui/ToastContainer'
import { useAuthStore } from './store/auth.store'

const CHUNK_RELOAD_KEY = 'chunk-reload-attempted'

function isChunkLoadError(err: Error): boolean {
  return (
    err.message.includes('Failed to fetch dynamically imported module') ||
    err.message.includes('Importing a module script failed')
  )
}

// Reload using a cache-bust query param so the browser is forced to GET a
// fresh index.html instead of replaying a cached copy that lacks no-cache
// headers (the most common reason the auto-reload didn't actually recover).
function reloadWithCacheBust() {
  try { sessionStorage.removeItem(CHUNK_RELOAD_KEY) } catch { /* ignore */ }
  const url = new URL(window.location.href)
  url.searchParams.set('_cb', Date.now().toString(36))
  window.location.replace(url.toString())
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }

  // NOTE: do NOT clear CHUNK_RELOAD_KEY in componentDidMount. The boundary
  // mounts BEFORE its lazy children resolve, so clearing it here would
  // re-arm the guard after every reload and produce an infinite loop —
  // exactly the bug the previous attempt at this fix shipped. The flag is
  // now cleared only by the user clicking Reload (manual recovery) or by
  // the browser discarding sessionStorage when the tab closes.

  componentDidCatch(error: Error) {
    if (!isChunkLoadError(error)) return
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
    } catch { /* storage disabled — best-effort one reload still useful */ }
    // Use cache-bust on the auto-reload too. Without it, a browser holding
    // a pre-fix cached index.html (no Cache-Control header) will replay the
    // same broken response.
    const url = new URL(window.location.href)
    url.searchParams.set('_cb', Date.now().toString(36))
    window.location.replace(url.toString())
  }

  render() {
    if (this.state.error) {
      const isDev = import.meta.env.DEV
      const chunkError = isChunkLoadError(this.state.error)
      return (
        <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '40px auto' }}>
          <h2 style={{ marginBottom: 12 }}>
            {chunkError ? 'App update available' : 'Runtime Error'}
          </h2>
          <p style={{ marginBottom: 16, color: '#4b5563' }}>
            {chunkError
              ? 'A newer version of AeroComm has been deployed. Reload to load the latest assets.'
              : isDev ? this.state.error.message : 'An unexpected error occurred.'}
          </p>
          <button
            onClick={reloadWithCacheBust}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none',
              background: '#2563eb', color: '#fff', fontSize: 14, cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {isDev && !chunkError && (
            <pre style={{ marginTop: 16, whiteSpace: 'pre-wrap', fontSize: 12, color: '#991b1b' }}>
              {this.state.error.stack}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

// Eagerly loaded (small, always needed)
import LoginPage from './pages/LoginPage'
import MfaPage from './pages/MfaPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import PrivacyPage from './pages/legal/PrivacyPage'
import TermsPage from './pages/legal/TermsPage'
import SmsConsentPage from './pages/legal/SmsConsentPage'
import PortalPage from './pages/portal/PortalPage'

// Lazy loaded for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ContactsPage = lazy(() => import('./pages/ContactsPage'))
const TripsPage = lazy(() => import('./pages/TripsPage'))
const TicketsPage = lazy(() => import('./pages/TicketsPage'))
const QuotesPage = lazy(() => import('./pages/QuotesPage'))
const AircraftPage = lazy(() => import('./pages/AircraftPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const CrewPage = lazy(() => import('./pages/CrewPage'))
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'))
const AutomationsPage = lazy(() => import('./pages/AutomationsPage'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SimulatorPage = lazy(() => import('./pages/SimulatorPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuthStore()
  if (!accessToken || accessToken === 'demo') {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
    <ToastContainer />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/mfa" element={<MfaPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/sms-consent" element={<SmsConsentPage />} />
      <Route path="/portal/:token" element={<PortalPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={<PageLoader />}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route
          path="contacts"
          element={
            <Suspense fallback={<PageLoader />}>
              <ContactsPage />
            </Suspense>
          }
        />
        <Route
          path="trips"
          element={
            <Suspense fallback={<PageLoader />}>
              <TripsPage />
            </Suspense>
          }
        />
        <Route
          path="calendar"
          element={
            <Suspense fallback={<PageLoader />}>
              <CalendarPage />
            </Suspense>
          }
        />
        <Route
          path="tickets"
          element={
            <Suspense fallback={<PageLoader />}>
              <TicketsPage />
            </Suspense>
          }
        />
        <Route
          path="quotes"
          element={
            <Suspense fallback={<PageLoader />}>
              <QuotesPage />
            </Suspense>
          }
        />
        <Route
          path="aircraft"
          element={
            <Suspense fallback={<PageLoader />}>
              <AircraftPage />
            </Suspense>
          }
        />
        <Route
          path="crew"
          element={
            <Suspense fallback={<PageLoader />}>
              <CrewPage />
            </Suspense>
          }
        />
        <Route
          path="maintenance"
          element={
            <Suspense fallback={<PageLoader />}>
              <MaintenancePage />
            </Suspense>
          }
        />
        <Route
          path="automations"
          element={
            <Suspense fallback={<PageLoader />}>
              <AutomationsPage />
            </Suspense>
          }
        />
        <Route
          path="notifications/templates"
          element={
            <Suspense fallback={<PageLoader />}>
              <TemplatesPage />
            </Suspense>
          }
        />
        <Route
          path="users"
          element={
            <Suspense fallback={<PageLoader />}>
              <UsersPage />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<PageLoader />}>
              <SettingsPage />
            </Suspense>
          }
        />
        <Route
          path="simulator"
          element={
            <Suspense fallback={<PageLoader />}>
              <SimulatorPage />
            </Suspense>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ErrorBoundary>
  )
}

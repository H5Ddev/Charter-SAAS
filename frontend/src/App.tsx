import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, Component, type ReactNode } from 'react'
import { Layout } from './components/layout/Layout'
import { ToastContainer } from './components/ui/ToastContainer'
import { useAuthStore } from './store/auth.store'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) {
    // Stale chunk after a new deploy — the hashed JS file no longer exists.
    // Force a hard reload so the browser picks up the new index.html + chunks.
    if (error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Importing a module script failed')) {
      window.location.reload()
    }
  }
  render() {
    if (this.state.error) {
      const isDev = import.meta.env.DEV
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'red' }}>
          <h2>Runtime Error</h2>
          <p>{isDev ? (this.state.error as Error).message : 'An unexpected error occurred'}</p>
          {isDev && <p>{(this.state.error as Error).stack}</p>}
        </div>
      )
    }
    return this.props.children
  }
}

// Eagerly loaded (small, always needed)
import LoginPage from './pages/LoginPage'
import MfaPage from './pages/MfaPage'
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

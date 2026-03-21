import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, Component, type ReactNode } from 'react'
import { Layout } from './components/layout/Layout'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'red' }}>
          <h2>Runtime Error</h2>
          <p>{(this.state.error as Error).message}</p>
          <p>{(this.state.error as Error).stack}</p>
        </div>
      )
    }
    return this.props.children
  }
}

// Eagerly loaded (small, always needed)
import LoginPage from './pages/LoginPage'
import MfaPage from './pages/MfaPage'

// Lazy loaded for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ContactsPage = lazy(() => import('./pages/ContactsPage'))
const TripsPage = lazy(() => import('./pages/TripsPage'))
const TicketsPage = lazy(() => import('./pages/TicketsPage'))
const QuotesPage = lazy(() => import('./pages/QuotesPage'))
const AircraftPage = lazy(() => import('./pages/AircraftPage'))
const AutomationsPage = lazy(() => import('./pages/AutomationsPage'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Auth guard disabled until backend is connected
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
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/mfa" element={<MfaPage />} />

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
          path="settings"
          element={
            <Suspense fallback={<PageLoader />}>
              <SettingsPage />
            </Suspense>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ErrorBoundary>
  )
}

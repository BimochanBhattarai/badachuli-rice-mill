import { useEffect, useState } from 'react'
import { AuthUser } from '@shared/types'
import SetupWizard from './pages/SetupWizard'
import Login from './pages/Login'
import UnitsPage from './pages/catalog/UnitsPage'
import ItemsPage from './pages/catalog/ItemsPage'

type AppState = 'loading' | 'setup' | 'login' | 'app'
type NavPage = 'dashboard' | 'units' | 'items'

const NAV: { id: NavPage; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'items', label: 'Items' },
  { id: 'units', label: 'Units' },
]

export default function App() {
  const [state, setState] = useState<AppState>('loading')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [page, setPage] = useState<NavPage>('dashboard')

  useEffect(() => {
    window.api.auth.isFirstRun().then((result) => {
      if (result.ok && result.data === true) {
        setState('setup')
      } else {
        setState('login')
      }
    })
  }, [])

  function handleSetupComplete(user: AuthUser) {
    setCurrentUser(user)
    setState('app')
  }

  function handleLogin(user: AuthUser) {
    setCurrentUser(user)
    setState('app')
  }

  function handleLogout() {
    setCurrentUser(null)
    setState('login')
  }

  if (state === 'loading') {
    return (
      <div className="splash">
        <p>Loading…</p>
      </div>
    )
  }

  if (state === 'setup') {
    return <SetupWizard onComplete={handleSetupComplete} />
  }

  if (state === 'login') {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="app-shell">
      <header className="app-bar">
        <span className="app-title">Badachuli Rice Mill</span>
        <nav className="app-nav">
          {NAV.map(n => (
            <button
              key={n.id}
              className={`nav-btn${page === n.id ? ' nav-btn-active' : ''}`}
              onClick={() => setPage(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <span className="app-user">
          {currentUser?.username} ({currentUser?.role})
        </span>
        <button onClick={handleLogout} className="btn-logout">
          Lock
        </button>
      </header>
      <main className="app-main">
        {page === 'dashboard' && (
          <div className="placeholder-page">
            <h2>Dashboard</h2>
            <p>Sales summary and alerts coming in Sprint 2.</p>
          </div>
        )}
        {page === 'units' && <UnitsPage />}
        {page === 'items' && <ItemsPage />}
      </main>
    </div>
  )
}

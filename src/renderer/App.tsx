import { useEffect, useState } from 'react'
import { AuthUser } from '@shared/types'
import SetupWizard from './pages/SetupWizard'
import Login from './pages/Login'
import UnitsPage from './pages/catalog/UnitsPage'
import ItemsPage from './pages/catalog/ItemsPage'
import PricesPage from './pages/catalog/PricesPage'
import StockPage from './pages/inventory/StockPage'
import DashboardPage from './pages/DashboardPage'
import StockInPage from './pages/stockin/StockInPage'
import SuppliersPage from './pages/stockin/SuppliersPage'
import SettingsPage from './pages/SettingsPage'
import ReportsPage from './pages/ReportsPage'
import ProcessingPage from './pages/processing/ProcessingPage'
import NewBillPage from './pages/billing/NewBillPage'
import CustomersPage from './pages/billing/CustomersPage'
import BillsPage from './pages/billing/BillsPage'

type AppState = 'loading' | 'setup' | 'login' | 'app'
type NavPage = 'dashboard' | 'billing' | 'bills' | 'customers' | 'stockin' | 'suppliers' | 'processing' | 'reports' | 'items' | 'prices' | 'stock' | 'units' | 'settings'

const NAV: { id: NavPage; label: string }[] = [
  { id: 'dashboard',  label: 'Dashboard' },
  { id: 'billing',    label: 'New Bill' },
  { id: 'bills',      label: 'Bills' },
  { id: 'customers',  label: 'Customers' },
  { id: 'stockin',    label: 'Stock-In' },
  { id: 'suppliers',  label: 'Suppliers' },
  { id: 'processing', label: 'Processing' },
  { id: 'reports',    label: 'Reports' },
  { id: 'items',      label: 'Items' },
  { id: 'prices',     label: 'Prices' },
  { id: 'stock',      label: 'Stock' },
  { id: 'units',      label: 'Units' },
  { id: 'settings',   label: 'Settings' },
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
        {page === 'dashboard' && <DashboardPage />}
        {page === 'reports' && <ReportsPage />}
        {page === 'units' && <UnitsPage />}
        {page === 'settings' && <SettingsPage currentUser={currentUser!} />}
        {page === 'items' && <ItemsPage />}
        {page === 'prices' && <PricesPage />}
        {page === 'stock' && <StockPage currentUser={currentUser!} />}
        {page === 'stockin'    && <StockInPage currentUser={currentUser!} />}
        {page === 'suppliers'  && <SuppliersPage />}
        {page === 'processing' && <ProcessingPage currentUser={currentUser!} />}
        {page === 'billing' && <NewBillPage currentUser={currentUser!} />}
        {page === 'bills' && <BillsPage currentUser={currentUser!} />}
        {page === 'customers' && <CustomersPage />}
      </main>
    </div>
  )
}

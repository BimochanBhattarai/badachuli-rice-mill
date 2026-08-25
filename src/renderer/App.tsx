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
import Sidebar from './components/Sidebar'

type AppState = 'loading' | 'setup' | 'login' | 'app'
type NavPage =
  | 'dashboard' | 'billing' | 'bills' | 'customers'
  | 'stockin' | 'suppliers' | 'processing'
  | 'reports' | 'items' | 'prices' | 'stock' | 'units' | 'settings'

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
      <Sidebar
        page={page}
        setPage={setPage}
        currentUser={currentUser!}
        onLogout={handleLogout}
      />
      <main className="app-main">
        {page === 'dashboard'  && <DashboardPage onNavigate={setPage} />}
        {page === 'reports'    && <ReportsPage />}
        {page === 'units'      && <UnitsPage />}
        {page === 'settings'   && <SettingsPage currentUser={currentUser!} />}
        {page === 'items'      && <ItemsPage />}
        {page === 'prices'     && <PricesPage />}
        {page === 'stock'      && <StockPage currentUser={currentUser!} />}
        {page === 'stockin'    && <StockInPage currentUser={currentUser!} />}
        {page === 'suppliers'  && <SuppliersPage />}
        {page === 'processing' && <ProcessingPage currentUser={currentUser!} />}
        {page === 'billing'    && <NewBillPage currentUser={currentUser!} />}
        {page === 'bills'      && <BillsPage currentUser={currentUser!} />}
        {page === 'customers'  && <CustomersPage />}
      </main>
    </div>
  )
}

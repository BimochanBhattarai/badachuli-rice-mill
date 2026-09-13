import { useEffect, useState } from 'react'
import { AuthUser } from '@shared/types'
import type { CustomerWithBalance } from '@shared/types/api'
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
import MillProcessingPage from './pages/processing/MillProcessingPage'
import NewBillPage from './pages/billing/NewBillPage'
import CustomersPage from './pages/billing/CustomersPage'
import LedgerPage from './pages/billing/LedgerPage'
import BillsPage, { type AmendData } from './pages/billing/BillsPage'
import Sidebar, { type NavPage } from './components/Sidebar'

type AppState = 'loading' | 'setup' | 'login' | 'app'

export default function App() {
  const [state, setState] = useState<AppState>('loading')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [page, setPage] = useState<NavPage>('dashboard')
  const [amendData, setAmendData] = useState<AmendData | null>(null)
  const [ledgerCustomer, setLedgerCustomer] = useState<CustomerWithBalance | null>(null)

  function goToLedger(customer: CustomerWithBalance) {
    setLedgerCustomer(customer)
    setPage('ledger')
  }

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
        setPage={p => { if (p !== 'ledger') setLedgerCustomer(null); setPage(p) }}
        currentUser={currentUser!}
        onLogout={handleLogout}
      />
      <main className="app-main">
        {page === 'dashboard'       && <DashboardPage onNavigate={setPage} />}
        {page === 'reports'         && <ReportsPage />}
        {page === 'units'           && <UnitsPage />}
        {page === 'settings'        && <SettingsPage currentUser={currentUser!} />}
        {page === 'items'           && <ItemsPage />}
        {page === 'prices'          && <PricesPage />}
        {page === 'stock'           && <StockPage currentUser={currentUser!} />}
        {page === 'stockin'         && <StockInPage currentUser={currentUser!} />}
        {page === 'suppliers'       && <SuppliersPage />}
        {page === 'mill-processing' && <MillProcessingPage currentUser={currentUser!} />}
        {page === 'billing'         && <NewBillPage currentUser={currentUser!} amendData={amendData} onAmendComplete={() => setAmendData(null)} />}
        {page === 'bills'           && <BillsPage currentUser={currentUser!} onAmend={data => { setAmendData(data); setPage('billing') }} />}
        {page === 'customers'       && <CustomersPage onViewLedger={goToLedger} />}
        {page === 'ledger'          && <LedgerPage currentUser={currentUser!} initialCustomer={ledgerCustomer} />}
      </main>
    </div>
  )
}

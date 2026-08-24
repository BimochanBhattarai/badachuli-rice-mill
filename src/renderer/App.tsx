import React, { useEffect, useState } from 'react'
import { AuthUser } from '@shared/types'
import SetupWizard from './pages/SetupWizard'
import Login from './pages/Login'

type AppState = 'loading' | 'setup' | 'login' | 'app'

export default function App() {
  const [state, setState] = useState<AppState>('loading')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)

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
        <span className="app-user">
          {currentUser?.username} ({currentUser?.role})
        </span>
        <button onClick={handleLogout} className="btn-logout">
          Lock
        </button>
      </header>
      <main className="app-main">
        <p>Dashboard — coming in Sprint 1</p>
      </main>
    </div>
  )
}

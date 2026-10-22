import React, { useState } from 'react'
import { AuthUser } from '@shared/types'

interface Props {
  onLogin: (user: AuthUser) => void
}

type View = 'login' | 'recover' | 'recover-success'

export default function Login({ onLogin }: Props) {
  const [view, setView] = useState<View>('login')

  // Login form state
  const [username, setUsername] = useState('')
  const [pin, setPin]           = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Recovery form state
  const [code, setCode]           = useState('')
  const [newPin, setNewPin]       = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [recoverErr, setRecoverErr] = useState('')
  const [recoverLoading, setRecoverLoading] = useState(false)
  const [recoveredUser, setRecoveredUser] = useState<AuthUser | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginErr(''); setLoginLoading(true)
    try {
      const result = await window.api.auth.login(username, pin)
      if (!result.ok || !result.data) { setLoginErr(result.error ?? 'Login failed'); return }
      onLogin(result.data)
    } finally { setLoginLoading(false) }
  }

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault()
    setRecoverErr('')
    if (!code.trim()) { setRecoverErr('Recovery code is required'); return }
    if (newPin.length < 4) { setRecoverErr('New PIN must be at least 4 digits'); return }
    if (newPin !== confirmPin) { setRecoverErr('PINs do not match'); return }
    setRecoverLoading(true)
    try {
      const result = await window.api.auth.recoverWithCode(code.trim(), newPin)
      if (!result.ok || !result.data) { setRecoverErr(result.error ?? 'Recovery failed'); return }
      setRecoveredUser(result.data)
      setView('recover-success')
    } finally { setRecoverLoading(false) }
  }

  // ── Recovery success ─────────────────────────────────────────────────────
  if (view === 'recover-success' && recoveredUser) {
    return (
      <div className="login-root">
        <div className="login-card">
          <div className="login-success-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 className="login-success-title">PIN reset successfully</h2>
          <p className="login-success-sub">
            Your new PIN is set for <strong>{recoveredUser.username}</strong>.
            Consider regenerating your recovery code from Settings → Security.
          </p>
          <button className="login-btn" onClick={() => onLogin(recoveredUser)}>
            Continue to app
          </button>
        </div>
      </div>
    )
  }

  // ── Recovery form ────────────────────────────────────────────────────────
  if (view === 'recover') {
    return (
      <div className="login-root">
        <div className="login-card">
          <button className="login-back-btn" onClick={() => { setView('login'); setRecoverErr(''); setCode(''); setNewPin(''); setConfirmPin('') }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="15 18 9 12 15 6"/></svg>
            Back to sign in
          </button>

          <h2 className="login-recover-title">Recover access</h2>
          <p className="login-recover-sub">
            Enter the recovery code you saved during setup to reset your PIN.
          </p>

          <form onSubmit={handleRecover}>
            <label className="login-label">
              Recovery code
              <input className="login-input login-input--code" type="text"
                placeholder="XXXX-XXXX-XXXX"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                autoFocus spellCheck={false} autoComplete="off" />
            </label>
            <label className="login-label">
              New PIN
              <input className="login-input" type="password" inputMode="numeric"
                placeholder="Minimum 4 digits"
                value={newPin} onChange={e => setNewPin(e.target.value)} />
            </label>
            <label className="login-label">
              Confirm new PIN
              <input className="login-input" type="password" inputMode="numeric"
                placeholder="Re-enter PIN"
                value={confirmPin} onChange={e => setConfirmPin(e.target.value)} />
            </label>

            {recoverErr && <p className="form-error">{recoverErr}</p>}

            <button className="login-btn" type="submit" disabled={recoverLoading}>
              {recoverLoading ? 'Resetting…' : 'Reset PIN'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Login form ───────────────────────────────────────────────────────────
  return (
    <div className="login-root">
      <div className="login-card">
        <h1>Badachuli Rice Mill</h1>
        <p>Sign in to continue</p>

        <form onSubmit={handleLogin}>
          <label>
            Username
            <input type="text" value={username}
              onChange={e => setUsername(e.target.value)} required autoFocus />
          </label>
          <label>
            PIN
            <input type="password" value={pin}
              onChange={e => setPin(e.target.value)} required />
          </label>

          {loginErr && <p className="form-error">{loginErr}</p>}

          <button type="submit" disabled={loginLoading}>
            {loginLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <button className="login-forgot-btn" onClick={() => { setView('recover'); setLoginErr('') }}>
          Forgot PIN?
        </button>
      </div>
    </div>
  )
}

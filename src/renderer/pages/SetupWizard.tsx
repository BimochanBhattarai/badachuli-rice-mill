import React, { useState } from 'react'
import { AuthUser } from '@shared/types'

interface Props {
  onComplete: (user: AuthUser) => void
}

type Step = 'form' | 'recovery'

export default function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('form')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null)
  const [copied, setCopied] = useState(false)

  const [username, setUsername]     = useState('')
  const [pin, setPin]               = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [millName, setMillName]     = useState('')
  const [pan, setPan]               = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pin !== confirmPin) { setError('PINs do not match'); return }
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }
    setLoading(true)
    try {
      if (millName.trim()) await window.api.settings.set('mill_name', millName.trim())
      if (pan.trim()) await window.api.settings.set('mill_pan', pan.trim())

      const result = await window.api.auth.setupOwner(username, pin)
      if (!result.ok || !result.data) { setError(result.error ?? 'Setup failed'); return }

      const user: AuthUser = { id: result.data.userId, username, role: 'owner' }
      setPendingUser(user)
      setRecoveryCode(result.data.recoveryCode)
      setStep('recovery')
    } finally { setLoading(false) }
  }

  function handleCopy() {
    navigator.clipboard.writeText(recoveryCode).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleProceed() {
    if (pendingUser) onComplete(pendingUser)
  }

  if (step === 'recovery') {
    return (
      <div className="setup-root">
        <div className="setup-card recovery-card">
          <div className="recovery-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="1.8">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h2 className="recovery-title">Save your recovery code</h2>
          <p className="recovery-subtitle">
            If you ever forget your PIN, you can use this code to reset it.
            <strong> Write it down somewhere safe.</strong> You will not see it again.
          </p>

          <div className="recovery-code-box">
            <span className="recovery-code-text">{recoveryCode}</span>
            <button className="recovery-copy-btn" onClick={handleCopy} title="Copy to clipboard">
              {copied
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              }
            </button>
          </div>

          <div className="recovery-warning">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>This code will never be shown again. Store it like a password.</span>
          </div>

          <button className="setup-proceed-btn" onClick={handleProceed}>
            I've saved my recovery code — Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="setup-root">
      <div className="setup-card">
        <div className="setup-header">
          <h1>Badachuli Rice Mill</h1>
          <p>First-time setup — takes less than a minute</p>
        </div>

        <form onSubmit={handleSubmit}>
          <fieldset>
            <legend>Mill information</legend>
            <label>
              Mill name
              <input type="text" placeholder="Badachuli Rice Mill" value={millName}
                onChange={e => setMillName(e.target.value)} autoFocus />
            </label>
            <label>
              PAN number
              <input type="text" placeholder="9-digit PAN" value={pan}
                onChange={e => setPan(e.target.value)} />
            </label>
          </fieldset>

          <fieldset>
            <legend>Owner account</legend>
            <label>
              Username
              <input type="text" placeholder="admin" value={username}
                onChange={e => setUsername(e.target.value)} required />
            </label>
            <label>
              PIN
              <input type="password" placeholder="Minimum 4 digits" value={pin}
                onChange={e => setPin(e.target.value)} required />
            </label>
            <label>
              Confirm PIN
              <input type="password" placeholder="Re-enter PIN" value={confirmPin}
                onChange={e => setConfirmPin(e.target.value)} required />
            </label>
          </fieldset>

          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Setting up…' : 'Complete setup'}
          </button>
        </form>
      </div>
    </div>
  )
}

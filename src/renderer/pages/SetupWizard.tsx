import React, { useState } from 'react'
import { AuthUser } from '@shared/types'

interface Props {
  onComplete: (user: AuthUser) => void
}

export default function SetupWizard({ onComplete }: Props) {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [millName, setMillName] = useState('')
  const [pan, setPan] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (pin !== confirmPin) {
      setError('PINs do not match')
      return
    }

    setLoading(true)
    try {
      if (millName.trim()) {
        await window.api.settings.set('mill_name', millName.trim())
      }
      if (pan.trim()) {
        await window.api.settings.set('mill_pan', pan.trim())
      }

      const result = await window.api.auth.setupOwner(username, pin)
      if (!result.ok || !result.data) {
        setError(result.error ?? 'Setup failed')
        return
      }

      onComplete({ id: result.data.userId, username, role: 'owner' })
    } finally {
      setLoading(false)
    }
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
              <input
                type="text"
                placeholder="Badachuli Rice Mill"
                value={millName}
                onChange={(e) => setMillName(e.target.value)}
                autoFocus
              />
            </label>
            <label>
              PAN number
              <input
                type="text"
                placeholder="9-digit PAN"
                value={pan}
                onChange={(e) => setPan(e.target.value)}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Owner account</legend>
            <label>
              Username
              <input
                type="text"
                placeholder="owner"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label>
              PIN
              <input
                type="password"
                placeholder="Minimum 4 characters"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
              />
            </label>
            <label>
              Confirm PIN
              <input
                type="password"
                placeholder="Re-enter PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                required
              />
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

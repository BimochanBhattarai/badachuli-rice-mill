import { useEffect, useState } from 'react'
import type { AuthUser } from '../../shared/types/api'

interface Props { currentUser: AuthUser }

interface MillSettings {
  mill_name: string
  mill_address: string
  mill_pan: string
  mill_phone: string
}

interface BillingSettings {
  bill_prefix: string
}

interface VatSettings {
  vat_enabled: boolean
  vat_rate: string
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{title}</h3>
      {children}
    </div>
  )
}

export default function SettingsPage({ currentUser }: Props) {
  // Mill info
  const [mill, setMill] = useState<MillSettings>({
    mill_name: '', mill_address: '', mill_pan: '', mill_phone: '',
  })
  const [millSaving, setMillSaving] = useState(false)
  const [millMsg, setMillMsg] = useState('')

  // Billing
  const [billing, setBilling] = useState<BillingSettings>({ bill_prefix: 'BRM' })
  const [billSaving, setBillSaving] = useState(false)
  const [billMsg, setBillMsg] = useState('')

  // VAT
  const [vat, setVat] = useState<VatSettings>({ vat_enabled: false, vat_rate: '13' })
  const [vatSaving, setVatSaving] = useState(false)
  const [vatMsg, setVatMsg] = useState('')

  // Change PIN
  const [pin, setPin] = useState({ current: '', next: '', confirm: '' })
  const [pinSaving, setPinSaving] = useState(false)
  const [pinMsg, setPinMsg] = useState('')
  const [pinError, setPinError] = useState('')

  useEffect(() => {
    async function load() {
      const keys = ['mill_name', 'mill_address', 'mill_pan', 'mill_phone',
                    'bill_prefix', 'vat_enabled', 'vat_rate']
      const values = await Promise.all(keys.map(k => window.api.settings.get(k)))
      const [name, address, pan, phone, prefix, vatEnabled, vatRate] = values as (string | boolean | null)[]

      setMill({
        mill_name:    (name    as string) ?? '',
        mill_address: (address as string) ?? '',
        mill_pan:     (pan     as string) ?? '',
        mill_phone:   (phone   as string) ?? '',
      })
      setBilling({ bill_prefix: (prefix as string) ?? 'BRM' })
      setVat({
        vat_enabled: Boolean(vatEnabled),
        vat_rate:    String(vatRate ?? '13'),
      })
    }
    load()
  }, [])

  async function saveMill(e: React.FormEvent) {
    e.preventDefault()
    setMillMsg(''); setMillSaving(true)
    try {
      await Promise.all([
        window.api.settings.set('mill_name',    mill.mill_name),
        window.api.settings.set('mill_address', mill.mill_address),
        window.api.settings.set('mill_pan',     mill.mill_pan),
        window.api.settings.set('mill_phone',   mill.mill_phone),
      ])
      setMillMsg('Saved')
      setTimeout(() => setMillMsg(''), 2000)
    } finally {
      setMillSaving(false)
    }
  }

  async function saveBilling(e: React.FormEvent) {
    e.preventDefault()
    if (!billing.bill_prefix.trim()) return
    setBillMsg(''); setBillSaving(true)
    try {
      await window.api.settings.set('bill_prefix', billing.bill_prefix.trim().toUpperCase())
      setBillMsg('Saved')
      setTimeout(() => setBillMsg(''), 2000)
    } finally {
      setBillSaving(false)
    }
  }

  async function saveVat(e: React.FormEvent) {
    e.preventDefault()
    const rate = parseFloat(vat.vat_rate)
    if (isNaN(rate) || rate < 0 || rate > 100) return
    setVatMsg(''); setVatSaving(true)
    try {
      await Promise.all([
        window.api.settings.set('vat_enabled', vat.vat_enabled),
        window.api.settings.set('vat_rate',    rate),
      ])
      setVatMsg('Saved')
      setTimeout(() => setVatMsg(''), 2000)
    } finally {
      setVatSaving(false)
    }
  }

  async function changePin(e: React.FormEvent) {
    e.preventDefault()
    setPinError(''); setPinMsg('')
    if (pin.next.length < 4) { setPinError('New PIN must be at least 4 digits'); return }
    if (pin.next !== pin.confirm) { setPinError('PINs do not match'); return }
    setPinSaving(true)
    try {
      const res = await window.api.auth.changePin(currentUser.id, pin.current, pin.next)
      if (!res.ok) { setPinError(res.error ?? 'Failed'); return }
      setPin({ current: '', next: '', confirm: '' })
      setPinMsg('PIN changed successfully')
      setTimeout(() => setPinMsg(''), 3000)
    } finally {
      setPinSaving(false)
    }
  }

  return (
    <div className="settings-page">
      {/* ── Mill Information ───────────────────────────────── */}
      <Section title="Mill Information">
        <form onSubmit={saveMill}>
          <div className="settings-fields">
            <label>
              Mill name
              <input
                type="text" value={mill.mill_name} required
                onChange={e => setMill(m => ({ ...m, mill_name: e.target.value }))}
              />
            </label>
            <label>
              Address
              <input
                type="text" value={mill.mill_address}
                onChange={e => setMill(m => ({ ...m, mill_address: e.target.value }))}
              />
            </label>
            <label>
              PAN / VAT number
              <input
                type="text" value={mill.mill_pan} placeholder="e.g. 123456789"
                onChange={e => setMill(m => ({ ...m, mill_pan: e.target.value }))}
              />
            </label>
            <label>
              Phone
              <input
                type="text" value={mill.mill_phone} placeholder="e.g. 081-123456"
                onChange={e => setMill(m => ({ ...m, mill_phone: e.target.value }))}
              />
            </label>
          </div>
          <div className="settings-actions">
            <button type="submit" className="btn-primary" disabled={millSaving}>
              {millSaving ? 'Saving…' : 'Save'}
            </button>
            {millMsg && <span className="success-msg">{millMsg}</span>}
          </div>
        </form>
      </Section>

      {/* ── Billing ────────────────────────────────────────── */}
      <Section title="Billing">
        <form onSubmit={saveBilling}>
          <div className="settings-fields">
            <label>
              Bill number prefix
              <input
                type="text" value={billing.bill_prefix}
                maxLength={8}
                onChange={e => setBilling({ bill_prefix: e.target.value })}
              />
              <span className="field-hint">
                Bills will be numbered {billing.bill_prefix.trim().toUpperCase() || 'BRM'}-0001, {billing.bill_prefix.trim().toUpperCase() || 'BRM'}-0002…
              </span>
            </label>
          </div>
          <div className="settings-actions">
            <button type="submit" className="btn-primary" disabled={billSaving}>
              {billSaving ? 'Saving…' : 'Save'}
            </button>
            {billMsg && <span className="success-msg">{billMsg}</span>}
          </div>
        </form>
      </Section>

      {/* ── VAT ────────────────────────────────────────────── */}
      <Section title="VAT">
        <form onSubmit={saveVat}>
          <div className="settings-fields">
            <label className="settings-toggle">
              <span>Enable VAT on bills</span>
              <input
                type="checkbox"
                checked={vat.vat_enabled}
                onChange={e => setVat(v => ({ ...v, vat_enabled: e.target.checked }))}
              />
            </label>
            {vat.vat_enabled && (
              <label>
                VAT rate (%)
                <input
                  type="number" step="0.01" min="0" max="100"
                  value={vat.vat_rate}
                  style={{ width: '100px' }}
                  onChange={e => setVat(v => ({ ...v, vat_rate: e.target.value }))}
                />
                <span className="field-hint">Nepal standard rate is 13%</span>
              </label>
            )}
          </div>
          <div className="settings-actions">
            <button type="submit" className="btn-primary" disabled={vatSaving}>
              {vatSaving ? 'Saving…' : 'Save'}
            </button>
            {vatMsg && <span className="success-msg">{vatMsg}</span>}
          </div>
        </form>
      </Section>

      {/* ── Change PIN ─────────────────────────────────────── */}
      <Section title={`Change PIN — ${currentUser.username}`}>
        <form onSubmit={changePin}>
          <div className="settings-fields">
            <label>
              Current PIN
              <input
                type="password" inputMode="numeric" pattern="[0-9]*"
                value={pin.current} autoComplete="current-password"
                onChange={e => setPin(p => ({ ...p, current: e.target.value }))}
              />
            </label>
            <label>
              New PIN
              <input
                type="password" inputMode="numeric" pattern="[0-9]*"
                value={pin.next} autoComplete="new-password"
                onChange={e => setPin(p => ({ ...p, next: e.target.value }))}
              />
            </label>
            <label>
              Confirm new PIN
              <input
                type="password" inputMode="numeric" pattern="[0-9]*"
                value={pin.confirm} autoComplete="new-password"
                onChange={e => setPin(p => ({ ...p, confirm: e.target.value }))}
              />
            </label>
          </div>
          {pinError && <p className="form-error">{pinError}</p>}
          <div className="settings-actions">
            <button type="submit" className="btn-primary" disabled={pinSaving}>
              {pinSaving ? 'Saving…' : 'Change PIN'}
            </button>
            {pinMsg && <span className="success-msg">{pinMsg}</span>}
          </div>
        </form>
      </Section>
    </div>
  )
}

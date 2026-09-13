import { useEffect, useState, useCallback } from 'react'
import type { AuthUser, BusinessRow } from '../../shared/types/api'
import { useLanguage } from '../i18n'

interface Props { currentUser: AuthUser }

interface VatSettings {
  vat_enabled: boolean
  vat_rate: string
}

interface BackupStatus {
  connected: boolean
  clientConfigured: boolean
  lastBackupAt: string | null
  lastBackupFile: string | null
  scheduleHour: number
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{title}</h3>
      {children}
    </div>
  )
}

interface BizDraft {
  name: string
  pan_number: string
  phone: string
  address: string
  bill_prefix: string
}

function toBizDraft(b: BusinessRow): BizDraft {
  return {
    name: b.name,
    pan_number: b.pan_number ?? '',
    phone: b.phone ?? '',
    address: b.address ?? '',
    bill_prefix: b.bill_prefix,
  }
}

function BusinessPanel({ biz, onSaved }: { biz: BusinessRow; onSaved: (updated: BusinessRow) => void }) {
  const { t } = useLanguage()
  const [draft, setDraft] = useState<BizDraft>(toBizDraft(biz))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    setDraft(toBizDraft(biz))
  }, [biz.id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.name.trim() || !draft.bill_prefix.trim()) {
      setErr('Name and Bill Prefix are required'); return
    }
    setErr(''); setMsg(''); setSaving(true)
    try {
      const res = await window.api.businesses.update(biz.id, {
        name: draft.name.trim(),
        pan_number: draft.pan_number.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        address: draft.address.trim() || undefined,
        bill_prefix: draft.bill_prefix.trim().toUpperCase(),
      })
      if (!res.ok) { setErr(res.error ?? 'Save failed'); return }
      setMsg(t('settings.saved'))
      setTimeout(() => setMsg(''), 2000)
      onSaved({ ...biz, ...draft, bill_prefix: draft.bill_prefix.trim().toUpperCase() })
    } finally {
      setSaving(false)
    }
  }

  function field(label: string, key: keyof BizDraft, opts?: { placeholder?: string; maxLength?: number }) {
    return (
      <label>
        {label}
        <input
          type="text"
          value={draft[key]}
          maxLength={opts?.maxLength}
          placeholder={opts?.placeholder}
          onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
        />
      </label>
    )
  }

  return (
    <form className="biz-panel" onSubmit={handleSave}>
      <div className="biz-panel-title">{t('common.business')} {biz.id}</div>
      <div className="settings-fields">
        {field(t('biz.name'), 'name', { placeholder: 'e.g. Badachuli Rice Mill' })}
        {field(t('biz.pan'), 'pan_number', { placeholder: 'e.g. 123456789' })}
        {field(t('common.phone'), 'phone', { placeholder: 'e.g. 081-123456' })}
        {field(t('common.address'), 'address', { placeholder: 'e.g. Burtibang, Baglung' })}
        <label>
          {t('biz.prefix')}
          <input
            type="text" value={draft.bill_prefix}
            maxLength={8}
            onChange={e => setDraft(d => ({ ...d, bill_prefix: e.target.value }))}
          />
          <span className="field-hint">
            {t('biz.prefix_hint')}: {draft.bill_prefix.trim().toUpperCase() || 'BRM'}-0001, -0002…
          </span>
        </label>
      </div>
      {err && <p className="form-error">{err}</p>}
      <div className="settings-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
        {msg && <span className="success-msg">{msg}</span>}
      </div>
    </form>
  )
}

const EMPTY_BIZ_DRAFT: BizDraft = { name: '', pan_number: '', phone: '', address: '', bill_prefix: '' }

export default function SettingsPage({ currentUser }: Props) {
  const { t } = useLanguage()
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [showAddBiz, setShowAddBiz] = useState(false)
  const [addDraft, setAddDraft] = useState<BizDraft>(EMPTY_BIZ_DRAFT)
  const [addSaving, setAddSaving] = useState(false)
  const [addErr, setAddErr] = useState('')

  const [vat, setVat] = useState<VatSettings>({ vat_enabled: false, vat_rate: '13' })
  const [vatSaving, setVatSaving] = useState(false)
  const [vatMsg, setVatMsg] = useState('')

  const [printerIp, setPrinterIp] = useState('')
  const [printerIpSaving, setPrinterIpSaving] = useState(false)
  const [printerIpMsg, setPrinterIpMsg] = useState('')

  const [pin, setPin] = useState({ current: '', next: '', confirm: '' })
  const [pinSaving, setPinSaving] = useState(false)
  const [pinMsg, setPinMsg] = useState('')
  const [pinError, setPinError] = useState('')

  const [backup, setBackup] = useState<BackupStatus | null>(null)
  const [backupClientId, setBackupClientId] = useState('')
  const [backupClientSecret, setBackupClientSecret] = useState('')
  const [backupMsg, setBackupMsg] = useState('')
  const [backupErr, setBackupErr] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)

  const refreshBackupStatus = useCallback(async () => {
    const s = await window.api.backup.status() as BackupStatus
    setBackup(s)
  }, [])

  useEffect(() => {
    window.api.businesses.getAll().then(r => { if (r.ok && r.data) setBusinesses(r.data) })
    refreshBackupStatus()

    async function loadSettings() {
      const [vatEnabled, vatRate, ip] = await Promise.all([
        window.api.settings.get('vat_enabled'),
        window.api.settings.get('vat_rate'),
        window.api.settings.get('printer_ip'),
      ])
      setVat({ vat_enabled: Boolean(vatEnabled), vat_rate: String(vatRate ?? '13') })
      setPrinterIp(String(ip ?? ''))
    }
    loadSettings()
  }, [])

  async function savePrinterIp(e: React.FormEvent) {
    e.preventDefault()
    setPrinterIpMsg(''); setPrinterIpSaving(true)
    try {
      await window.api.settings.set('printer_ip', printerIp.trim())
      setPrinterIpMsg(t('settings.saved'))
      setTimeout(() => setPrinterIpMsg(''), 2000)
    } finally {
      setPrinterIpSaving(false)
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
        window.api.settings.set('vat_rate', rate),
      ])
      setVatMsg(t('settings.saved'))
      setTimeout(() => setVatMsg(''), 2000)
    } finally {
      setVatSaving(false)
    }
  }

  async function changePin(e: React.FormEvent) {
    e.preventDefault()
    setPinError(''); setPinMsg('')
    if (pin.next.length < 4) { setPinError(t('settings.pin_min')); return }
    if (pin.next !== pin.confirm) { setPinError(t('settings.pin_mismatch')); return }
    setPinSaving(true)
    try {
      const res = await window.api.auth.changePin(currentUser.id, pin.current, pin.next)
      if (!res.ok) { setPinError(res.error ?? 'Failed'); return }
      setPin({ current: '', next: '', confirm: '' })
      setPinMsg(t('settings.pin_changed'))
      setTimeout(() => setPinMsg(''), 3000)
    } finally {
      setPinSaving(false)
    }
  }

  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault()
    if (!backupClientId.trim() || !backupClientSecret.trim()) {
      setBackupErr('Client ID र Client Secret दुवै आवश्यक छन्।'); return
    }
    setBackupErr(''); setBackupMsg(''); setBackupBusy(true)
    try {
      await window.api.backup.saveCredentials(backupClientId.trim(), backupClientSecret.trim())
      setBackupMsg('Credentials saved.')
      setTimeout(() => setBackupMsg(''), 2000)
      await refreshBackupStatus()
    } finally {
      setBackupBusy(false)
    }
  }

  async function handleConnectDrive() {
    setBackupErr(''); setBackupMsg(''); setBackupBusy(true)
    try {
      setBackupMsg('Browser मा Google authorization खुल्दैछ…')
      const res = await window.api.backup.connect() as { ok: boolean; error?: string }
      if (!res.ok) { setBackupErr(res.error ?? 'Connection failed'); setBackupMsg('') }
      else { setBackupMsg('Google Drive connected!') }
      await refreshBackupStatus()
    } finally {
      setBackupBusy(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Google Drive disconnect गर्ने?')) return
    await window.api.backup.disconnect()
    await refreshBackupStatus()
  }

  async function handleBackupNow() {
    setBackupErr(''); setBackupMsg(''); setBackupBusy(true)
    try {
      setBackupMsg('Backup upload हुँदैछ…')
      const res = await window.api.backup.now() as { ok: boolean; error?: string; fileName?: string }
      if (!res.ok) { setBackupErr(res.error ?? 'Backup failed'); setBackupMsg('') }
      else { setBackupMsg(`Backup सफल: ${res.fileName}`) }
      await refreshBackupStatus()
    } finally {
      setBackupBusy(false)
    }
  }

  async function handleScheduleHour(h: number) {
    await window.api.backup.setScheduleHour(h)
    await refreshBackupStatus()
  }

  function handleBizSaved(updated: BusinessRow) {
    setBusinesses(prev => prev.map(b => b.id === updated.id ? updated : b))
  }

  async function handleAddBiz(e: React.FormEvent) {
    e.preventDefault()
    setAddErr('')
    if (!addDraft.name.trim()) { setAddErr('Business name is required'); return }
    if (!addDraft.bill_prefix.trim()) { setAddErr('Bill prefix is required'); return }
    setAddSaving(true)
    try {
      const res = await window.api.businesses.create({
        name: addDraft.name.trim(),
        pan_number: addDraft.pan_number.trim() || undefined,
        phone: addDraft.phone.trim() || undefined,
        address: addDraft.address.trim() || undefined,
        bill_prefix: addDraft.bill_prefix.trim().toUpperCase(),
      })
      if (!res.ok || !res.data) { setAddErr(res.error ?? 'Failed'); return }
      const r = await window.api.businesses.getAll()
      if (r.ok && r.data) setBusinesses(r.data)
      setAddDraft(EMPTY_BIZ_DRAFT)
      setShowAddBiz(false)
    } finally {
      setAddSaving(false)
    }
  }

  async function handleDeleteBiz(id: number) {
    if (!confirm('Remove this business? This cannot be undone.')) return
    const res = await window.api.businesses.delete(id)
    if (!res.ok) { alert(res.error); return }
    setBusinesses(prev => prev.filter(b => b.id !== id))
  }

  return (
    <div className="settings-page">
      <Section title={t('settings.business_mgmt')}>
        <p className="field-hint" style={{ marginBottom: '1rem' }}>
          {t('settings.business_note')}
        </p>
        <div className="biz-panels">
          {businesses.map(b => (
            <div key={b.id} style={{ position: 'relative' }}>
              <BusinessPanel biz={b} onSaved={handleBizSaved} />
              {businesses.length > 1 && (
                <button
                  className="btn-danger btn-sm"
                  style={{ position: 'absolute', top: '1rem', right: '1rem' }}
                  onClick={() => handleDeleteBiz(b.id)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {showAddBiz ? (
          <form className="biz-panel" onSubmit={handleAddBiz} style={{ marginTop: '1rem' }}>
            <div className="biz-panel-title">New Business</div>
            <div className="settings-fields">
              <label>
                {t('biz.name')}
                <input type="text" value={addDraft.name} placeholder="e.g. Badachuli Flour Mill"
                  onChange={e => setAddDraft(d => ({ ...d, name: e.target.value }))} autoFocus />
              </label>
              <label>
                {t('biz.pan')}
                <input type="text" value={addDraft.pan_number} placeholder="e.g. 123456789"
                  onChange={e => setAddDraft(d => ({ ...d, pan_number: e.target.value }))} />
              </label>
              <label>
                {t('common.phone')}
                <input type="text" value={addDraft.phone} placeholder="e.g. 081-123456"
                  onChange={e => setAddDraft(d => ({ ...d, phone: e.target.value }))} />
              </label>
              <label>
                {t('common.address')}
                <input type="text" value={addDraft.address} placeholder="e.g. Kohalpur, Banke"
                  onChange={e => setAddDraft(d => ({ ...d, address: e.target.value }))} />
              </label>
              <label>
                {t('biz.prefix')}
                <input type="text" value={addDraft.bill_prefix} maxLength={8}
                  placeholder="e.g. BRM2"
                  onChange={e => setAddDraft(d => ({ ...d, bill_prefix: e.target.value }))} />
                <span className="field-hint">
                  {t('biz.prefix_hint')}: {addDraft.bill_prefix.trim().toUpperCase() || 'BRM2'}-0001…
                </span>
              </label>
            </div>
            {addErr && <p className="form-error">{addErr}</p>}
            <div className="settings-actions">
              <button type="submit" className="btn-primary" disabled={addSaving}>
                {addSaving ? t('common.saving') : t('common.create')}
              </button>
              <button type="button" className="btn-ghost" onClick={() => { setShowAddBiz(false); setAddErr('') }}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        ) : (
          <button className="btn-ghost" style={{ marginTop: '1rem' }} onClick={() => setShowAddBiz(true)}>
            + Add Business
          </button>
        )}
      </Section>

      <Section title="प्रिन्टर सेटिङ">
        <form onSubmit={savePrinterIp}>
          <div className="settings-fields">
            <label>
              थर्मल प्रिन्टर IP ठेगाना
              <input
                type="text"
                placeholder="192.168.1.100"
                value={printerIp}
                onChange={e => setPrinterIp(e.target.value)}
              />
              <span className="field-hint">
                थर्मल प्रिन्टरको LAN IP ठेगाना (e.g. 192.168.1.100) — पोर्ट 9100 मा ESC/POS पठाउँछ। खाली छाड्नुभयो भने Windows मा system printer प्रयोग हुन्छ।
              </span>
            </label>
          </div>
          <div className="settings-actions">
            <button type="submit" className="btn-primary" disabled={printerIpSaving}>
              {printerIpSaving ? t('common.saving') : t('common.save')}
            </button>
            {printerIpMsg && <span className="success-msg">{printerIpMsg}</span>}
          </div>
        </form>
      </Section>

      <Section title={t('settings.vat')}>
        <form onSubmit={saveVat}>
          <div className="settings-fields">
            <label className="settings-toggle">
              <span>{t('settings.vat_enable')}</span>
              <input
                type="checkbox"
                checked={vat.vat_enabled}
                onChange={e => setVat(v => ({ ...v, vat_enabled: e.target.checked }))}
              />
            </label>
            {vat.vat_enabled && (
              <label>
                {t('settings.vat_rate')}
                <input
                  type="number" step="0.01" min="0" max="100"
                  value={vat.vat_rate}
                  style={{ width: '100px' }}
                  onChange={e => setVat(v => ({ ...v, vat_rate: e.target.value }))}
                />
                <span className="field-hint">{t('settings.vat_hint')}</span>
              </label>
            )}
          </div>
          <div className="settings-actions">
            <button type="submit" className="btn-primary" disabled={vatSaving}>
              {vatSaving ? t('common.saving') : t('common.save')}
            </button>
            {vatMsg && <span className="success-msg">{vatMsg}</span>}
          </div>
        </form>
      </Section>

      <Section title="Google Drive Backup">
        {backup && (
          <>
            {/* Step 1 — credentials */}
            <div className="settings-fields" style={{ marginBottom: '1rem' }}>
              <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
                <strong>Setup (एक पटक मात्र):</strong> <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">console.cloud.google.com</a> मा
                Project बनाउनुस् → Google Drive API enable गर्नुस् → OAuth2 Desktop credentials बनाएर
                Client ID र Secret तल राख्नुस्।
                Authorized redirect URI मा <code>http://localhost:48123</code> थप्नुस्।
              </p>
              <form onSubmit={handleSaveCredentials}>
                <div className="settings-fields">
                  <label>
                    Client ID
                    <input
                      type="text"
                      placeholder="*.apps.googleusercontent.com"
                      value={backupClientId}
                      onChange={e => setBackupClientId(e.target.value)}
                    />
                  </label>
                  <label>
                    Client Secret
                    <input
                      type="password"
                      placeholder="GOCSPX-…"
                      value={backupClientSecret}
                      onChange={e => setBackupClientSecret(e.target.value)}
                    />
                  </label>
                </div>
                <div className="settings-actions">
                  <button type="submit" className="btn-primary" disabled={backupBusy}>
                    Save Credentials
                  </button>
                </div>
              </form>
            </div>

            {/* Step 2 — connect */}
            {backup.clientConfigured && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: backup.connected ? 'var(--color-success, #16a34a)' : 'var(--color-muted, #888)' }}>
                  {backup.connected ? '● Connected to Google Drive' : '○ Not connected'}
                </span>
                {!backup.connected ? (
                  <button className="btn-primary" onClick={handleConnectDrive} disabled={backupBusy}>
                    Connect Google Account
                  </button>
                ) : (
                  <button className="btn-ghost" onClick={handleDisconnect} disabled={backupBusy}>
                    Disconnect
                  </button>
                )}
              </div>
            )}

            {/* Step 3 — controls (only when connected) */}
            {backup.connected && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <button className="btn-primary" onClick={handleBackupNow} disabled={backupBusy}>
                    {backupBusy && backupMsg.includes('upload') ? 'Uploading…' : 'Backup Now'}
                  </button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    साँझ backup बजे:
                    <select
                      value={backup.scheduleHour}
                      onChange={e => handleScheduleHour(Number(e.target.value))}
                      style={{ width: 'auto' }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 12).map(h => (
                        <option key={h} value={h}>{h}:00 ({h < 13 ? `${h - 12} PM` : `${h - 12} PM`})</option>
                      ))}
                    </select>
                  </label>
                </div>
                {backup.lastBackupAt && (
                  <p className="field-hint">
                    Last backup: {new Date(backup.lastBackupAt).toLocaleString()} — {backup.lastBackupFile}
                  </p>
                )}
              </>
            )}

            {backupErr && <p className="form-error" style={{ marginTop: '0.5rem' }}>{backupErr}</p>}
            {backupMsg && !backupErr && <p className="success-msg" style={{ marginTop: '0.5rem' }}>{backupMsg}</p>}
          </>
        )}
      </Section>

      <Section title={`${t('settings.change_pin')} — ${currentUser.username}`}>
        <form onSubmit={changePin}>
          <div className="settings-fields">
            <label>
              {t('settings.current_pin')}
              <input
                type="password" inputMode="numeric" pattern="[0-9]*"
                value={pin.current} autoComplete="current-password"
                onChange={e => setPin(p => ({ ...p, current: e.target.value }))}
              />
            </label>
            <label>
              {t('settings.new_pin')}
              <input
                type="password" inputMode="numeric" pattern="[0-9]*"
                value={pin.next} autoComplete="new-password"
                onChange={e => setPin(p => ({ ...p, next: e.target.value }))}
              />
            </label>
            <label>
              {t('settings.confirm_pin')}
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
              {pinSaving ? t('common.saving') : t('settings.change_pin')}
            </button>
            {pinMsg && <span className="success-msg">{pinMsg}</span>}
          </div>
        </form>
      </Section>
    </div>
  )
}

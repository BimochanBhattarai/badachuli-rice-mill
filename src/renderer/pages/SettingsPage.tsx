import { useEffect, useState, useCallback, useRef } from 'react'
import type { AuthUser, BusinessRow, UserRow, AuditLogRow } from '../../shared/types/api'
import { useLanguage } from '../i18n'

interface Props { currentUser: AuthUser }

// ── Helpers ────────────────────────────────────────────────────────────────

function parseUtc(iso: string): Date {
  // SQLite datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC without a 'Z'.
  // JS Date() assumes local time when no zone is given, so we must append 'Z'.
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T')
  return new Date(normalized.endsWith('Z') ? normalized : normalized + 'Z')
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - parseUtc(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Info popover ───────────────────────────────────────────────────────────

function InfoPopover({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="info-popover-wrap" ref={ref}>
      <button type="button" className="info-btn" aria-label="Setup instructions"
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}>i</button>
      {open && (
        <div className="info-popover" role="tooltip">
          <button className="info-popover-close" onClick={() => setOpen(false)}>×</button>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Business tab ───────────────────────────────────────────────────────────

interface BizDraft { name: string; pan_number: string; phone: string; address: string; bill_prefix: string }
const EMPTY_BIZ: BizDraft = { name: '', pan_number: '', phone: '', address: '', bill_prefix: '' }
function toBizDraft(b: BusinessRow): BizDraft {
  return { name: b.name, pan_number: b.pan_number ?? '', phone: b.phone ?? '', address: b.address ?? '', bill_prefix: b.bill_prefix }
}

function BusinessCard({ biz, onSaved, canDelete, onDelete }: {
  biz: BusinessRow; onSaved: (b: BusinessRow) => void; canDelete: boolean; onDelete: () => void
}) {
  const { t } = useLanguage()
  const [draft, setDraft] = useState<BizDraft>(toBizDraft(biz))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { setDraft(toBizDraft(biz)) }, [biz.id])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.name.trim() || !draft.bill_prefix.trim()) { setErr('Name and prefix are required'); return }
    setErr(''); setMsg(''); setSaving(true)
    try {
      const res = await window.api.businesses.update(biz.id, {
        name: draft.name.trim(), pan_number: draft.pan_number.trim() || undefined,
        phone: draft.phone.trim() || undefined, address: draft.address.trim() || undefined,
        bill_prefix: draft.bill_prefix.trim().toUpperCase(),
      })
      if (!res.ok) { setErr(res.error ?? 'Failed'); return }
      setMsg('Saved'); setTimeout(() => setMsg(''), 2000)
      onSaved({ ...biz, ...draft, bill_prefix: draft.bill_prefix.trim().toUpperCase() })
    } finally { setSaving(false) }
  }

  function F(label: string, key: keyof BizDraft, hint?: string) {
    return (
      <div className="sp-field" key={key}>
        <label className="sp-label">{label}</label>
        <input className="sp-input" type="text" value={draft[key]}
          onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} />
        {hint && <span className="sp-hint">{hint}</span>}
      </div>
    )
  }

  return (
    <form className="sp-card" onSubmit={save}>
      <div className="sp-card-head">
        <span className="sp-card-label">{t('common.business')}</span>
        {canDelete && (
          <button type="button" className="sp-icon-btn sp-icon-btn--danger" onClick={onDelete} title="Remove">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        )}
      </div>
      <div className="sp-grid-2">
        {F(t('biz.name'), 'name')}
        {F(t('biz.pan'), 'pan_number')}
        {F(t('common.phone'), 'phone')}
        {F(t('common.address'), 'address')}
        {F(t('biz.prefix'), 'bill_prefix', `Preview: ${draft.bill_prefix.trim().toUpperCase() || 'BRM'}-0001`)}
      </div>
      {err && <p className="sp-error">{err}</p>}
      <div className="sp-row">
        <button type="submit" className="sp-btn sp-btn--primary" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</button>
        {msg && <span className="sp-ok">{msg}</span>}
      </div>
    </form>
  )
}

function BusinessTab() {
  const { t } = useLanguage()
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<BizDraft>(EMPTY_BIZ)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    window.api.businesses.getAll().then(r => { if (r.ok && r.data) setBusinesses(r.data) })
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) { setErr('Name is required'); return }
    if (!draft.bill_prefix.trim()) { setErr('Bill prefix is required'); return }
    setErr(''); setSaving(true)
    try {
      const res = await window.api.businesses.create({
        name: draft.name.trim(), pan_number: draft.pan_number.trim() || undefined,
        phone: draft.phone.trim() || undefined, address: draft.address.trim() || undefined,
        bill_prefix: draft.bill_prefix.trim().toUpperCase(),
      })
      if (!res.ok) { setErr(res.error ?? 'Failed'); return }
      const r = await window.api.businesses.getAll()
      if (r.ok && r.data) setBusinesses(r.data)
      setDraft(EMPTY_BIZ); setAdding(false)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Remove this business?')) return
    const res = await window.api.businesses.delete(id)
    if (!res.ok) { alert(res.error); return }
    setBusinesses(prev => prev.filter(b => b.id !== id))
  }

  return (
    <div className="sp-tab-body">
      <p className="sp-muted">{t('settings.business_note')}</p>
      <div className="sp-biz-grid">
        {businesses.map(b => (
          <BusinessCard key={b.id} biz={b}
            onSaved={u => setBusinesses(prev => prev.map(x => x.id === u.id ? u : x))}
            canDelete={businesses.length > 1} onDelete={() => handleDelete(b.id)} />
        ))}
      </div>
      {adding ? (
        <form className="sp-card sp-card--dashed" onSubmit={handleAdd}>
          <div className="sp-card-head">
            <span className="sp-card-label">New Business</span>
            <button type="button" className="sp-icon-btn" onClick={() => { setAdding(false); setErr('') }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="sp-grid-2">
            {(['name', 'pan_number', 'phone', 'address', 'bill_prefix'] as (keyof BizDraft)[]).map(key => (
              <div className="sp-field" key={key}>
                <label className="sp-label">{key === 'bill_prefix' ? t('biz.prefix') : key === 'pan_number' ? t('biz.pan') : key}</label>
                <input className="sp-input" type="text" value={draft[key]}
                  onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} autoFocus={key === 'name'} />
              </div>
            ))}
          </div>
          {err && <p className="sp-error">{err}</p>}
          <div className="sp-row">
            <button type="submit" className="sp-btn sp-btn--primary" disabled={saving}>{saving ? t('common.saving') : t('common.create')}</button>
            <button type="button" className="sp-btn sp-btn--ghost" onClick={() => { setAdding(false); setErr('') }}>{t('common.cancel')}</button>
          </div>
        </form>
      ) : (
        <button className="sp-btn sp-btn--ghost sp-add-biz-btn" onClick={() => setAdding(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Business
        </button>
      )}
    </div>
  )
}

// ── Users tab ──────────────────────────────────────────────────────────────

function UsersTab({ currentUser }: { currentUser: AuthUser }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [resetFor, setResetFor] = useState<number | null>(null)
  const [renameFor, setRenameFor] = useState<number | null>(null)
  const [renameValues, setRenameValues] = useState<Record<number, string>>({})
  const [newPins, setNewPins] = useState<Record<number, { pin: string; confirm: string }>>({})
  const [addForm, setAddForm] = useState({ username: '', pin: '', confirm: '', role: 'operator' as 'owner' | 'operator' })
  const [addErr, setAddErr] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [rowMsgs, setRowMsgs] = useState<Record<number, string>>({})
  const [rowErrs, setRowErrs] = useState<Record<number, string>>({})

  const refresh = useCallback(() => {
    window.api.users.getAll().then(r => { if (r.ok && r.data) setUsers(r.data) })
  }, [])
  useEffect(() => { refresh() }, [refresh])

  function rowMsg(id: number, m: string) { setRowMsgs(p => ({ ...p, [id]: m })); setTimeout(() => setRowMsgs(p => ({ ...p, [id]: '' })), 2500) }
  function rowErr(id: number, e: string) { setRowErrs(p => ({ ...p, [id]: e })); setTimeout(() => setRowErrs(p => ({ ...p, [id]: '' })), 3000) }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.username.trim()) { setAddErr('Username required'); return }
    if (addForm.pin.length < 4) { setAddErr('PIN must be at least 4 digits'); return }
    if (addForm.pin !== addForm.confirm) { setAddErr('PINs do not match'); return }
    setAddErr(''); setAddSaving(true)
    try {
      const res = await window.api.users.create(addForm.username, addForm.pin, addForm.role, currentUser.id)
      if (!res.ok) { setAddErr(res.error ?? 'Failed'); return }
      setAddForm({ username: '', pin: '', confirm: '', role: 'operator' }); setShowAdd(false); refresh()
    } finally { setAddSaving(false) }
  }

  async function handleToggle(user: UserRow) {
    const active = user.is_active === 0
    const res = await window.api.users.setActive(user.id, active, currentUser.id)
    if (!res.ok) { rowErr(user.id, res.error ?? 'Failed'); return }
    rowMsg(user.id, active ? 'Activated' : 'Deactivated'); refresh()
  }

  async function handleReset(user: UserRow) {
    const p = newPins[user.id]
    if (!p?.pin || p.pin.length < 4) { rowErr(user.id, 'PIN must be at least 4 digits'); return }
    if (p.pin !== p.confirm) { rowErr(user.id, 'PINs do not match'); return }
    rowErr(user.id, '')
    const res = await window.api.users.resetPin(user.id, p.pin, currentUser.id)
    if (!res.ok) { rowErr(user.id, res.error ?? 'Failed'); return }
    rowMsg(user.id, 'PIN reset'); setNewPins(prev => { const c = { ...prev }; delete c[user.id]; return c }); setResetFor(null)
  }

  async function handleRename(user: UserRow) {
    const newName = renameValues[user.id]?.trim()
    if (!newName || newName.length < 2) { rowErr(user.id, 'Username must be at least 2 characters'); return }
    rowErr(user.id, '')
    const res = await window.api.users.rename(user.id, newName, currentUser.id)
    if (!res.ok) { rowErr(user.id, res.error ?? 'Failed'); return }
    rowMsg(user.id, 'Username updated')
    setRenameFor(null)
    setRenameValues(prev => { const c = { ...prev }; delete c[user.id]; return c })
    refresh()
  }

  const active = users.filter(u => u.is_active).length
  const owners = users.filter(u => u.role === 'owner').length

  return (
    <div className="sp-tab-body">
      <div className="sp-users-header">
        <div className="sp-stat-chips">
          <span className="sp-stat-chip">{users.length} total</span>
          <span className="sp-stat-chip sp-stat-chip--green">{active} active</span>
          <span className="sp-stat-chip sp-stat-chip--blue">{owners} {owners === 1 ? 'owner' : 'owners'}</span>
        </div>
        <button className="sp-btn sp-btn--primary" onClick={() => { setShowAdd(true); setAddErr('') }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add User
        </button>
      </div>

      {showAdd && (
        <form className="sp-card sp-card--dashed" onSubmit={handleAdd}>
          <div className="sp-card-head">
            <span className="sp-card-label">New User</span>
            <button type="button" className="sp-icon-btn" onClick={() => { setShowAdd(false); setAddErr('') }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="sp-grid-2">
            <div className="sp-field">
              <label className="sp-label">Username</label>
              <input className="sp-input" type="text" autoFocus autoComplete="off"
                value={addForm.username} onChange={e => setAddForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div className="sp-field">
              <label className="sp-label">Role</label>
              <select className="sp-select" value={addForm.role}
                onChange={e => setAddForm(f => ({ ...f, role: e.target.value as 'owner' | 'operator' }))}>
                <option value="operator">Operator</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <div className="sp-field">
              <label className="sp-label">PIN</label>
              <input className="sp-input sp-input--pin" type="password" inputMode="numeric"
                value={addForm.pin} onChange={e => setAddForm(f => ({ ...f, pin: e.target.value }))} />
            </div>
            <div className="sp-field">
              <label className="sp-label">Confirm PIN</label>
              <input className="sp-input sp-input--pin" type="password" inputMode="numeric"
                value={addForm.confirm} onChange={e => setAddForm(f => ({ ...f, confirm: e.target.value }))} />
            </div>
          </div>
          {addErr && <p className="sp-error">{addErr}</p>}
          <div className="sp-row">
            <button type="submit" className="sp-btn sp-btn--primary" disabled={addSaving}>{addSaving ? 'Creating…' : 'Create User'}</button>
            <button type="button" className="sp-btn sp-btn--ghost" onClick={() => { setShowAdd(false); setAddErr('') }}>Cancel</button>
          </div>
        </form>
      )}

      <div className="sp-user-list">
        {users.map(u => (
          <div key={u.id} className={`sp-user-row ${u.is_active ? '' : 'sp-user-row--inactive'}`}>
            <div className="sp-user-main">
              <div className={`sp-avatar sp-avatar--${u.role}`}>{u.username.slice(0, 2).toUpperCase()}</div>
              <div className="sp-user-info">
                <div className="sp-user-name">
                  {u.username}
                  {u.id === currentUser.id && <span className="sp-you-tag">you</span>}
                </div>
                <div className="sp-user-meta">
                  <span className={`sp-role-badge sp-role-badge--${u.role}`}>{u.role}</span>
                  <span className={`sp-status-dot ${u.is_active ? 'sp-status-dot--active' : ''}`} />
                  <span className="sp-user-since">since {new Date(u.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="sp-user-actions">
              {rowMsgs[u.id] && <span className="sp-ok sp-ok--sm">{rowMsgs[u.id]}</span>}
              {rowErrs[u.id] && <span className="sp-error sp-error--sm">{rowErrs[u.id]}</span>}
              <button className="sp-btn sp-btn--ghost sp-btn--sm"
                onClick={() => {
                  setRenameFor(renameFor === u.id ? null : u.id)
                  setResetFor(null)
                  setRenameValues(p => ({ ...p, [u.id]: u.username }))
                }}>
                Edit
              </button>
              {u.id !== currentUser.id && (
                <>
                  <button className="sp-btn sp-btn--ghost sp-btn--sm"
                    onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setRenameFor(null) }}>
                    Reset PIN
                  </button>
                  <button className={`sp-btn sp-btn--sm ${u.is_active ? 'sp-btn--danger-ghost' : 'sp-btn--ghost'}`}
                    onClick={() => handleToggle(u)}>
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </>
              )}
            </div>
            {renameFor === u.id && (
              <div className="sp-reset-form">
                <input className="sp-input" type="text" autoFocus autoComplete="off"
                  placeholder="New username"
                  value={renameValues[u.id] ?? u.username}
                  onChange={e => setRenameValues(p => ({ ...p, [u.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(u); if (e.key === 'Escape') { setRenameFor(null); rowErr(u.id, '') } }}
                />
                <button className="sp-btn sp-btn--primary sp-btn--sm" onClick={() => handleRename(u)}>Save</button>
                <button className="sp-btn sp-btn--ghost sp-btn--sm" onClick={() => { setRenameFor(null); rowErr(u.id, '') }}>Cancel</button>
              </div>
            )}
            {resetFor === u.id && (
              <div className="sp-reset-form">
                <input className="sp-input sp-input--pin" type="password" inputMode="numeric"
                  placeholder="New PIN"
                  value={newPins[u.id]?.pin ?? ''}
                  onChange={e => setNewPins(p => ({ ...p, [u.id]: { pin: e.target.value, confirm: p[u.id]?.confirm ?? '' } }))} />
                <input className="sp-input sp-input--pin" type="password" inputMode="numeric"
                  placeholder="Confirm PIN"
                  value={newPins[u.id]?.confirm ?? ''}
                  onChange={e => setNewPins(p => ({ ...p, [u.id]: { pin: p[u.id]?.pin ?? '', confirm: e.target.value } }))} />
                <button className="sp-btn sp-btn--primary sp-btn--sm" onClick={() => handleReset(u)}>Confirm</button>
                <button className="sp-btn sp-btn--ghost sp-btn--sm" onClick={() => { setResetFor(null); rowErr(u.id, '') }}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Backup tab ─────────────────────────────────────────────────────────────

interface BackupStatus {
  connected: boolean; clientConfigured: boolean
  lastBackupAt: string | null; lastBackupFile: string | null; scheduleHour: number
}

function BackupTab() {
  const [backup, setBackup] = useState<BackupStatus | null>(null)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const s = await window.api.backup.status() as BackupStatus
    setBackup(s)
  }, [])
  useEffect(() => { refresh() }, [refresh])

  function flash(m: string, isErr = false) {
    if (isErr) { setErr(m); setMsg('') } else { setMsg(m); setErr('') }
  }

  async function handleSaveCreds(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId.trim() || !clientSecret.trim()) { flash('Both fields required', true); return }
    setBusy(true)
    try {
      await window.api.backup.saveCredentials(clientId.trim(), clientSecret.trim())
      flash('Credentials saved'); setClientId(''); setClientSecret(''); await refresh()
    } finally { setBusy(false) }
  }

  async function handleConnect() {
    setBusy(true); flash('Opening browser for Google authorization…')
    try {
      const res = await window.api.backup.connect() as { ok: boolean; error?: string }
      if (!res.ok) flash(res.error ?? 'Connection failed', true)
      else flash('Connected to Google Drive!'); await refresh()
    } finally { setBusy(false) }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Google Drive?')) return
    await window.api.backup.disconnect(); await refresh(); flash('')
  }

  async function handleBackupNow() {
    setBusy(true); flash('Uploading backup…')
    try {
      const res = await window.api.backup.now() as { ok: boolean; error?: string; fileName?: string }
      if (!res.ok) flash(res.error ?? 'Backup failed', true)
      else flash(`Backup uploaded: ${res.fileName}`); await refresh()
    } finally { setBusy(false) }
  }

  if (!backup) return <div className="sp-tab-body"><p className="sp-muted">Loading…</p></div>

  return (
    <div className="sp-tab-body">
      <div className={`sp-status-banner ${backup.connected ? 'sp-status-banner--ok' : 'sp-status-banner--off'}`}>
        <div className="sp-status-pulse" />
        <div className="sp-status-text">
          <div className="sp-status-title">{backup.connected ? 'Connected to Google Drive' : 'Not connected to Google Drive'}</div>
          {backup.lastBackupAt && (
            <div className="sp-status-sub">
              Last backup: {parseUtc(backup.lastBackupAt).toLocaleString()}
              {backup.lastBackupFile && <> · <code>{backup.lastBackupFile}</code></>}
            </div>
          )}
        </div>
        <div className="sp-status-actions">
          {backup.connected ? (
            <>
              <button className="sp-btn sp-btn--primary" onClick={handleBackupNow} disabled={busy}>
                {busy && msg.includes('pload') ? 'Uploading…' : 'Backup Now'}
              </button>
              <button className="sp-btn sp-btn--ghost" onClick={handleDisconnect} disabled={busy}>Disconnect</button>
            </>
          ) : backup.clientConfigured ? (
            <button className="sp-btn sp-btn--primary" onClick={handleConnect} disabled={busy}>
              {busy ? 'Opening browser…' : 'Connect Google Account'}
            </button>
          ) : null}
        </div>
      </div>

      {backup.connected && (
        <div className="sp-card">
          <div className="sp-card-head"><span className="sp-card-label">Auto Backup Schedule</span></div>
          <div className="sp-row" style={{ alignItems: 'center', gap: '1rem' }}>
            <span className="sp-label" style={{ margin: 0 }}>Back up every evening at</span>
            <select className="sp-select" value={backup.scheduleHour}
              onChange={async e => { await window.api.backup.setScheduleHour(Number(e.target.value)); await refresh() }}>
              {Array.from({ length: 13 }, (_, i) => i + 11).map(h => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00 ({h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="sp-card">
        <div className="sp-card-head">
          <span className="sp-card-label">Google Cloud Credentials</span>
          <InfoPopover>
            <div className="info-steps">
              <p className="info-steps-title">One-time setup — ~5 minutes</p>
              <ol>
                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">console.cloud.google.com</a><span className="info-note">Sign in with badachuliricemill@gmail.com</span></li>
                <li>Create a project<span className="info-note">Top-left dropdown → New Project → "Badachuli"</span></li>
                <li>Enable Google Drive API<span className="info-note">APIs &amp; Services → Library → search "Drive" → Enable</span></li>
                <li>Create OAuth credentials<span className="info-note">Credentials → Create → OAuth client ID → Desktop app</span></li>
                <li>Add redirect URI<span className="info-note">Under "Authorized redirect URIs" add:</span><code>http://localhost:48123</code></li>
                <li>Copy Client ID &amp; Secret below<span className="info-note">Click the pencil icon on your credential</span></li>
              </ol>
            </div>
          </InfoPopover>
        </div>
        <form onSubmit={handleSaveCreds}>
          <div className="sp-grid-2" style={{ marginBottom: '1rem' }}>
            <div className="sp-field">
              <label className="sp-label">Client ID</label>
              <input className="sp-input" type="text" placeholder="xxxx.apps.googleusercontent.com"
                value={clientId} onChange={e => setClientId(e.target.value)} autoComplete="off" />
            </div>
            <div className="sp-field">
              <label className="sp-label">Client Secret</label>
              <input className="sp-input" type="password" placeholder="GOCSPX-…"
                value={clientSecret} onChange={e => setClientSecret(e.target.value)} autoComplete="off" />
            </div>
          </div>
          {backup.clientConfigured && !clientId && <p className="sp-hint-ok">✓ Credentials saved. Enter new values to update.</p>}
          <div className="sp-row">
            <button type="submit" className="sp-btn sp-btn--primary" disabled={busy}>Save &amp; Apply</button>
            {backup.clientConfigured && !backup.connected && (
              <button type="button" className="sp-btn sp-btn--accent" onClick={handleConnect} disabled={busy}>Connect Google Account</button>
            )}
          </div>
        </form>
      </div>

      {err && <div className="sp-toast sp-toast--err">{err}</div>}
      {msg && !err && <div className="sp-toast sp-toast--ok">{msg}</div>}
    </div>
  )
}

// ── Activity tab ───────────────────────────────────────────────────────────

interface ActionMeta { label: string; color: string; details: string }

function parseAction(action: string, payloadJson: string | null): ActionMeta {
  let p: Record<string, unknown> = {}
  try { if (payloadJson) p = JSON.parse(payloadJson) } catch {}

  switch (action) {
    case 'LOGIN_SUCCESS':    return { label: 'Login',          color: 'blue',   details: 'Logged in' }
    case 'LOGIN_FAILED':     return { label: 'Login Failed',   color: 'red',    details: `Failed attempt${p.username ? ` for "${p.username}"` : ''}` }
    case 'LOGOUT':           return { label: 'Logout',         color: 'gray',   details: 'Logged out' }
    case 'SETUP_COMPLETED':  return { label: 'Setup',          color: 'purple', details: 'App setup completed' }
    case 'BILL_CREATED':     return { label: 'Bill Created',   color: 'green',  details: `${p.billNumber ?? ''}  Rs. ${Number(p.grandTotal ?? 0).toLocaleString()}  (${p.itemCount} item${p.itemCount === 1 ? '' : 's'})` }
    case 'BILL_CANCELLED':   return { label: 'Bill Cancelled', color: 'red',    details: `${p.billNumber ?? ''}: ${p.reason ?? ''}` }
    case 'PAYMENT_COLLECTED':return { label: 'Payment',        color: 'teal',   details: `Rs. ${Number(p.amount ?? 0).toLocaleString()} via ${p.method}` }
    case 'STOCK_IN':         return { label: 'Stock In',       color: 'amber',  details: `${p.itemCount} item${p.itemCount === 1 ? '' : 's'} · Rs. ${Number(p.totalAmount ?? 0).toLocaleString()}` }
    case 'STOCK_ADJUSTED':   return { label: 'Adjustment',     color: 'amber',  details: 'Stock adjusted' }
    case 'USER_CREATED':     return { label: 'User Created',   color: 'green',  details: `"${p.username}" created as ${p.role}` }
    case 'USER_DEACTIVATED': return { label: 'Deactivated',    color: 'orange', details: 'User deactivated' }
    case 'USER_REACTIVATED': return { label: 'Activated',      color: 'green',  details: 'User reactivated' }
    case 'USER_PIN_RESET':   return { label: 'PIN Reset',      color: 'orange', details: 'PIN reset by admin' }
    case 'PIN_CHANGED':      return { label: 'PIN Changed',    color: 'orange', details: 'User changed PIN' }
    case 'SETTINGS_CHANGED': return { label: 'Setting',        color: 'gray',   details: `${p.key} updated` }
    default:                 return { label: action,            color: 'gray',   details: payloadJson ?? '' }
  }
}

function ActivityTab() {
  const [entries, setEntries] = useState<AuditLogRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.audit.getAll(300).then(r => {
      if (r.ok && r.data) setEntries(r.data)
      setLoading(false)
    })
  }, [])

  const lower = search.toLowerCase()
  const filtered = lower
    ? entries.filter(e => {
        const m = parseAction(e.action, e.payload_json)
        return (
          e.action.toLowerCase().includes(lower) ||
          (e.operator_username ?? '').toLowerCase().includes(lower) ||
          m.details.toLowerCase().includes(lower) ||
          m.label.toLowerCase().includes(lower)
        )
      })
    : entries

  return (
    <div className="sp-tab-body sp-tab-body--wide">
      <div className="sp-activity-toolbar">
        <div className="sp-search-wrap">
          <svg className="sp-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="sp-search-input" type="search" placeholder="Search actions, users, details…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="sp-muted" style={{ fontSize: '0.8rem' }}>{filtered.length} entries</span>
      </div>

      {loading ? (
        <p className="sp-muted">Loading activity log…</p>
      ) : filtered.length === 0 ? (
        <div className="sp-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d6cfc7" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p>{search ? 'No matching entries' : 'No activity recorded yet'}</p>
        </div>
      ) : (
        <div className="sp-activity-log">
          {filtered.map(entry => {
            const meta = parseAction(entry.action, entry.payload_json)
            return (
              <div key={entry.id} className="sp-log-row">
                <div className="sp-log-time" title={parseUtc(entry.created_at).toLocaleString()}>
                  {timeAgo(entry.created_at)}
                </div>
                <div className="sp-log-user">
                  {entry.operator_username
                    ? <span className="sp-log-username">{entry.operator_username}</span>
                    : <span className="sp-log-system">system</span>}
                </div>
                <span className={`sp-action-badge sp-action-badge--${meta.color}`}>{meta.label}</span>
                <div className="sp-log-details">{meta.details}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Recovery code card ─────────────────────────────────────────────────────

function RecoveryCodeCard({ currentUser }: { currentUser: AuthUser }) {
  const [pinInput, setPinInput] = useState('')
  const [newCode, setNewCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function handleRegenerate(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const res = await window.api.auth.regenerateRecoveryCode(currentUser.id, pinInput)
      if (!res.ok || !res.data) { setErr(res.error ?? 'Failed'); return }
      setNewCode(res.data.recoveryCode)
      setPinInput('')
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Unexpected error')
    } finally { setBusy(false) }
  }

  function handleCopy() {
    if (!newCode) return
    navigator.clipboard.writeText(newCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  function handleClose() { setOpen(false); setNewCode(null); setPinInput(''); setErr('') }

  return (
    <div className="sp-card">
      <div className="sp-card-head">
        <span className="sp-card-label">Recovery Code</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>

      {!open && !newCode && (
        <>
          <p className="sp-muted" style={{ marginBottom: '1rem' }}>
            A recovery code lets you reset your PIN if you forget it. Keep it somewhere safe — it is not stored in the app.
          </p>
          <button className="sp-btn sp-btn--ghost" onClick={() => setOpen(true)}>Regenerate Recovery Code</button>
        </>
      )}

      {open && !newCode && (
        <form onSubmit={handleRegenerate}>
          <p className="sp-muted" style={{ marginBottom: '0.75rem' }}>
            Enter your current PIN to generate a new recovery code. The old code will stop working immediately.
          </p>
          <div className="sp-field" style={{ maxWidth: 220, marginBottom: '0.75rem' }}>
            <label className="sp-label">Current PIN</label>
            <input className="sp-input sp-input--pin" type="password" inputMode="numeric"
              autoFocus value={pinInput} onChange={e => setPinInput(e.target.value)} />
          </div>
          {err && <p className="sp-error">{err}</p>}
          <div className="sp-row">
            <button type="submit" className="sp-btn sp-btn--primary" disabled={busy}>{busy ? 'Generating…' : 'Generate'}</button>
            <button type="button" className="sp-btn sp-btn--ghost" onClick={handleClose}>Cancel</button>
          </div>
        </form>
      )}

      {newCode && (
        <div className="recovery-reveal">
          <p className="recovery-reveal-warn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Write this down. It will not be shown again.
          </p>
          <div className="recovery-code-box recovery-code-box--inline">
            <span className="recovery-code-text">{newCode}</span>
            <button className="recovery-copy-btn" onClick={handleCopy} title="Copy">
              {copied
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              }
            </button>
          </div>
          <button className="sp-btn sp-btn--ghost" style={{ marginTop: '0.75rem' }} onClick={handleClose}>Done</button>
        </div>
      )}
    </div>
  )
}

// ── Security tab ───────────────────────────────────────────────────────────

function SecurityTab({ currentUser }: { currentUser: AuthUser }) {
  const { t, lang, setLang } = useLanguage()
  const [pins, setPins] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg('')
    if (pins.next.length < 4) { setErr(t('settings.pin_min')); return }
    if (pins.next !== pins.confirm) { setErr(t('settings.pin_mismatch')); return }
    setSaving(true)
    try {
      const res = await window.api.auth.changePin(currentUser.id, pins.current, pins.next)
      if (!res.ok) { setErr(res.error ?? 'Failed'); return }
      setPins({ current: '', next: '', confirm: '' })
      setMsg(t('settings.pin_changed')); setTimeout(() => setMsg(''), 3000)
    } finally { setSaving(false) }
  }

  return (
    <div className="sp-tab-body">
      <div className="sp-card">
        <div className="sp-card-head">
          <span className="sp-card-label">Change PIN</span>
          <span className="sp-card-sub">@{currentUser.username}</span>
        </div>
        <form onSubmit={handleChangePin}>
          <div className="sp-grid-1">
            {([
              ['current', t('settings.current_pin'), 'current-password'],
              ['next',    t('settings.new_pin'),     'new-password'],
              ['confirm', t('settings.confirm_pin'), 'new-password'],
            ] as [keyof typeof pins, string, string][]).map(([key, label, autoComplete]) => (
              <div className="sp-field" key={key}>
                <label className="sp-label">{label}</label>
                <input className="sp-input sp-input--pin" type="password"
                  inputMode="numeric" pattern="[0-9]*" autoComplete={autoComplete}
                  value={pins[key]} onChange={e => setPins(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
          {err && <p className="sp-error">{err}</p>}
          <div className="sp-row">
            <button type="submit" className="sp-btn sp-btn--primary" disabled={saving}>
              {saving ? t('common.saving') : t('settings.change_pin')}
            </button>
            {msg && <span className="sp-ok">{msg}</span>}
          </div>
        </form>
      </div>

      <RecoveryCodeCard currentUser={currentUser} />

      <div className="sp-card">
        <div className="sp-card-head"><span className="sp-card-label">Language</span></div>
        <div className="sp-lang-row">
          {(['en', 'ne'] as const).map(l => (
            <button key={l} className={`sp-lang-btn ${lang === l ? 'sp-lang-btn--active' : ''}`}
              onClick={() => setLang(l)}>
              {l === 'en' ? 'English' : 'नेपाली'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Archive tab ────────────────────────────────────────────────────────────

type ArchivedItem     = { id: number; name: string; is_buyable: number; is_sellable: number; is_processable: number; unit_name: string; is_active: number }
type ArchivedCustomer = { id: number; name: string; phone: string | null; address: string | null; is_active: number }
type ArchivedVariant  = { id: number; item_id: number; name: string; is_default: number; is_active: number; priority: number | null; item_name: string }

function ArchiveTab() {
  const [section, setSection]     = useState<'items' | 'variants' | 'customers'>('items')
  const [items, setItems]         = useState<ArchivedItem[]>([])
  const [variants, setVariants]   = useState<ArchivedVariant[]>([])
  const [customers, setCustomers] = useState<ArchivedCustomer[]>([])
  const [loading, setLoading]     = useState(false)
  const [msg, setMsg]             = useState('')

  async function load() {
    setLoading(true)
    const [ir, vr, cr] = await Promise.all([
      window.api.items.getAll(false),
      window.api.variants.getArchived(),
      window.api.customers.getAll(false),
    ])
    if (ir.ok && ir.data) setItems((ir.data as unknown as ArchivedItem[]).filter(i => !i.is_active))
    if (vr.ok && vr.data) setVariants(vr.data as unknown as ArchivedVariant[])
    if (cr.ok && cr.data) setCustomers((cr.data as unknown as ArchivedCustomer[]).filter(c => !c.is_active))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleRestoreItem(id: number) {
    setMsg('')
    const r = await window.api.items.restore(id)
    if (r.ok) { await load(); setMsg('Item restored successfully.') }
    else setMsg('Error: ' + (r.error ?? 'Restore failed'))
  }

  async function handleRestoreVariant(id: number) {
    setMsg('')
    const r = await window.api.variants.restore(id)
    if (r.ok) { await load(); setMsg('Variant restored successfully.') }
    else setMsg('Error: ' + (r.error ?? 'Restore failed'))
  }

  async function handleRestoreCustomer(id: number) {
    setMsg('')
    const r = await window.api.customers.restore(id)
    if (r.ok) { await load(); setMsg('Customer restored successfully.') }
    else setMsg('Error: ' + (r.error ?? 'Restore failed'))
  }

  const purposeLabel = (i: ArchivedItem) =>
    [i.is_processable && 'Processing', i.is_sellable && 'Selling', i.is_buyable && 'Buying']
      .filter(Boolean).join(', ')

  return (
    <div className="sp-section">
      <div className="sp-card-head"><span className="sp-card-label">Archived Records</span></div>
      {msg && <div style={{ color: '#15803d', marginBottom: '0.75rem', fontSize: '0.85rem' }}>{msg}</div>}
      <div className="price-tabs" style={{ marginBottom: '1rem' }}>
        <button className={`price-tab-btn${section === 'items' ? ' price-tab-active' : ''}`} onClick={() => setSection('items')}>Items</button>
        <button className={`price-tab-btn${section === 'variants' ? ' price-tab-active' : ''}`} onClick={() => setSection('variants')}>Variants</button>
        <button className={`price-tab-btn${section === 'customers' ? ' price-tab-active' : ''}`} onClick={() => setSection('customers')}>Customers</button>
      </div>

      {loading && <div className="text-muted">Loading…</div>}

      {!loading && section === 'items' && (
        items.length === 0
          ? <div className="empty-state">No archived items.</div>
          : <table className="data-table">
              <thead><tr><th>Name</th><th>Unit</th><th>Purpose</th><th></th></tr></thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td className="text-muted">{i.unit_name}</td>
                    <td className="text-muted">{purposeLabel(i)}</td>
                    <td><button className="btn-primary btn-sm" onClick={() => handleRestoreItem(i.id)}>Restore</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
      )}

      {!loading && section === 'variants' && (
        variants.length === 0
          ? <div className="empty-state">No archived variants.</div>
          : <table className="data-table">
              <thead><tr><th>Item</th><th>Variant</th><th></th></tr></thead>
              <tbody>
                {variants.map(v => (
                  <tr key={v.id}>
                    <td className="text-muted">{v.item_name}</td>
                    <td>{v.name}</td>
                    <td><button className="btn-primary btn-sm" onClick={() => handleRestoreVariant(v.id)}>Restore</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
      )}

      {!loading && section === 'customers' && (
        customers.length === 0
          ? <div className="empty-state">No archived customers.</div>
          : <table className="data-table">
              <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th></th></tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="text-muted">{c.phone ?? '—'}</td>
                    <td className="text-muted">{c.address ?? '—'}</td>
                    <td><button className="btn-primary btn-sm" onClick={() => handleRestoreCustomer(c.id)}>Restore</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

type Tab = 'business' | 'users' | 'backup' | 'activity' | 'security' | 'archive'

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  business: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  users:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  backup:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  activity: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  security: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  archive:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
}

export default function SettingsPage({ currentUser }: Props) {
  const isOwner = currentUser.role === 'owner'
  const [tab, setTab] = useState<Tab>('business')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'business', label: 'Business' },
    ...(isOwner ? [{ id: 'users' as Tab, label: 'Users' }] : []),
    { id: 'backup', label: 'Backup' },
    ...(isOwner ? [{ id: 'activity' as Tab, label: 'Activity' }] : []),
    { id: 'security', label: 'Security' },
    ...(isOwner ? [{ id: 'archive' as Tab, label: 'Archives' }] : []),
  ]

  useEffect(() => {
    if (!isOwner && (tab === 'users' || tab === 'activity' || tab === 'archive')) setTab('business')
  }, [isOwner, tab])

  return (
    <div className="sp-page">
      <div className="sp-tabbar">
        {tabs.map(t => (
          <button key={t.id} className={`sp-tab ${tab === t.id ? 'sp-tab--active' : ''}`}
            onClick={() => setTab(t.id)}>
            {TAB_ICONS[t.id]}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="sp-content">
        {tab === 'business' && <BusinessTab />}
        {tab === 'users'    && isOwner && <UsersTab currentUser={currentUser} />}
        {tab === 'backup'   && <BackupTab />}
        {tab === 'activity' && isOwner && <ActivityTab />}
        {tab === 'security' && <SecurityTab currentUser={currentUser} />}
        {tab === 'archive'  && isOwner && <ArchiveTab />}
      </div>
    </div>
  )
}

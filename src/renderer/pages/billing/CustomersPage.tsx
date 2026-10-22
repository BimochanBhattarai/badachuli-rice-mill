import { useEffect, useRef, useState } from 'react'
import type { CustomerWithBalance, CustomerStatementEntry } from '../../../shared/types/api'
import { X, MoreVertical } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { BalanceAmount } from '../../components/BalanceAmount'

interface FormState { name: string; phone: string; address: string; notes: string; pan_number: string }
const EMPTY: FormState = { name: '', phone: '', address: '', notes: '', pan_number: '' }

interface Props {
  onViewLedger: (customer: CustomerWithBalance) => void
}

export default function CustomersPage({ onViewLedger }: Props) {
  const { t, fmtAmt, fmtDate } = useLanguage()
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([])
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)


  const [statementCustomer, setStatementCustomer] = useState<CustomerWithBalance | null>(null)
  const [statementData, setStatementData] = useState<CustomerStatementEntry[] | null>(null)
  const [statementLoading, setStatementLoading] = useState(false)

  // Row action menu. Positioned fixed from the button's rect so it is never clipped
  // by the table's own overflow.
  const [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(null)
  const [infoCustomer, setInfoCustomer] = useState<CustomerWithBalance | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const [deactivatingId, setDeactivatingId] = useState<number | null>(null)
  const deactivatingCustomer = customers.find(c => c.id === deactivatingId) ?? null

  async function load() {
    const res = search
      ? await window.api.customers.search(search)
      : await window.api.customers.getAll()
    if (res.ok && res.data) setCustomers(res.data)
  }

  useEffect(() => { load() }, [search])

  // Close the row menu on outside click, Escape, scroll or resize.
  useEffect(() => {
    if (!menu) return
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenu(null) }
    const close = () => setMenu(null)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [menu])

  function toggleMenu(e: React.MouseEvent, id: number) {
    e.stopPropagation()
    if (menu?.id === id) { setMenu(null); return }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    // Anchored to the button's RIGHT edge: the button now sits at the trailing edge of
    // the table, so opening leftwards keeps the menu on screen.
    setMenu({ id, x: r.right, y: r.bottom + 4 })
  }

  function runAction(fn: () => void) { setMenu(null); fn() }


  function openCreate() {
    setEditingId(null); setForm(EMPTY); setError(''); setShowForm(true)
  }

  function openEdit(c: CustomerWithBalance) {
    setEditingId(c.id)
    setForm({ name: c.name, phone: c.phone ?? '', address: c.address ?? '', notes: c.notes ?? '', pan_number: c.pan_number ?? '' })
    setError(''); setShowForm(true)
  }

  function cancel() { setShowForm(false); setEditingId(null); setForm(EMPTY); setError('') }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    setSaving(true)
    try {
      const res = editingId !== null
        ? await window.api.customers.update(editingId, form.name, form.phone || undefined, form.address || undefined, form.notes || undefined, form.pan_number || undefined)
        : await window.api.customers.create(form.name, form.phone || undefined, form.address || undefined, form.notes || undefined, form.pan_number || undefined)
      if (!res.ok) { setError(res.error ?? 'Error'); return }
      cancel(); load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setSaving(false)
    }
  }

  async function loadStatement(customerId: number) {
    setStatementData(null)
    setStatementLoading(true)
    try {
      // No business scoping: the balance is one global figure per customer, so
      // filtering rows would make the running Balance column meaningless.
      const res = await window.api.bills.getCustomerStatement(customerId)
      if (res.ok && res.data) setStatementData(res.data)
      else setStatementData([])
    } finally {
      setStatementLoading(false)
    }
  }

  async function openStatement(c: CustomerWithBalance) {
    setStatementCustomer(c)
    loadStatement(c.id)
  }

  async function confirmDeactivate() {
    if (!deactivatingId) return
    await window.api.customers.deactivate(deactivatingId)
    setDeactivatingId(null)
    load()
  }

  return (
    <div className="catalog-page">
      {deactivatingCustomer && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <div className="confirm-modal-header">Archive Customer</div>
            <p style={{ margin: '0.5rem 0 1rem', color: '#57534e', fontSize: '0.9rem' }}>
              Archive <strong>{deactivatingCustomer.name}</strong>? They will be hidden from all lists.
              {deactivatingCustomer.outstanding > 0.005 && (
                <span style={{ display: 'block', marginTop: '0.4rem', color: '#dc2626', fontWeight: 600 }}>
                  Warning: outstanding balance of Rs. {deactivatingCustomer.outstanding.toFixed(2)}
                </span>
              )}
            </p>
            <div className="form-actions">
              <button className="btn-danger btn-sm" onClick={confirmDeactivate}>Archive</button>
              <button className="btn-ghost btn-sm" onClick={() => setDeactivatingId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {statementCustomer && (
        <div className="confirm-overlay">
          <div className="confirm-modal" style={{ width: 680, maxWidth: '96vw' }}>
            <div className="confirm-modal-header">
              <span>{t('customer.statement')} — {statementCustomer.name}</span>
              <button
                onClick={() => setStatementCustomer(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="confirm-detail-row" style={{ gap: '1.5rem' }}>
              {statementCustomer.phone && (
                <span className="text-muted">{statementCustomer.phone}</span>
              )}
              <span style={{ color: statementCustomer.outstanding > 0 ? '#dc2626' : '#15803d', fontWeight: 700, fontSize: '0.85rem' }}>
                {t('customer.outstanding_label')}: {fmtAmt(statementCustomer.outstanding)}
              </span>
            </div>

            <div className="confirm-divider" />

            {statementLoading ? (
              <div className="empty-state">{t('customer.loading_statement')}</div>
            ) : !statementData || statementData.length === 0 ? (
              <div className="empty-state">{t('customer.no_transactions')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>{t('customer.date_time')}</th>
                      <th>{t('customer.bill_num')}</th>
                      <th>{t('customer.description')}</th>
                      <th style={{ textAlign: 'right' }}>{t('customer.debit')}</th>
                      <th style={{ textAlign: 'right' }}>{t('customer.credit')}</th>
                      <th style={{ textAlign: 'right' }}>{t('stock.balance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementData.map((e, i) => (
                      <tr key={i}>
                        <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.created_at)}</td>
                        <td>
                          {e.bill_number
                            ? <span className="bill-number-badge" style={{ fontSize: '0.65rem' }}>{e.bill_number}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td style={{ maxWidth: 200, lineHeight: 1.3 }}>{e.description}</td>
                        <td style={{ textAlign: 'right', color: e.debit > 0 ? '#1c1917' : '#d4c9bd' }}>
                          {e.debit > 0 ? fmtAmt(e.debit) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', color: e.credit > 0 ? '#15803d' : '#d4c9bd', fontWeight: e.credit > 0 ? 700 : 400 }}>
                          {e.credit > 0 ? fmtAmt(e.credit) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: e.balance > 0.005 ? '#dc2626' : '#15803d' }}>
                          {fmtAmt(Math.abs(e.balance))}
                          {e.balance > 0.005 ? ' Dr.' : e.balance < -0.005 ? ' Cr.' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="catalog-header">
        <h2>{t('customer.title')}</h2>
        <button className="btn-primary" onClick={openCreate}>{t('customer.add')}</button>
      </div>

      <div className="catalog-filters">
        <input type="text" placeholder={t('customer.search')} value={search}
          onChange={e => setSearch(e.target.value)} className="search-input" />
      </div>

      {showForm && (
        <div className="inline-form">
          <h3>{editingId !== null ? t('customer.edit') : t('customer.new')}</h3>
          {error && <p className="form-error">{error}</p>}
          <form onSubmit={submit}>
            <div className="form-row">
              <label>{t('common.name')}<input type="text" value={form.name} required autoFocus
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
              <label>{t('common.phone')}<input type="text" value={form.phone} placeholder={t('common.optional')}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></label>
              <label>{t('common.address')}<input type="text" value={form.address} placeholder={t('common.optional')}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></label>
              <label>{t('common.notes')}<input type="text" value={form.notes} placeholder={t('common.optional')}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></label>
              <label>PAN नं<input type="text" value={form.pan_number} placeholder={t('common.optional')}
                onChange={e => setForm(f => ({ ...f, pan_number: e.target.value }))} /></label>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t('common.saving') : editingId !== null ? t('common.update') : t('common.create')}
              </button>
              <button type="button" className="btn-ghost" onClick={cancel}>{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>{t('common.name')}</th>
            <th style={{ textAlign: 'right' }}>{t('customer.total_billed')}</th>
            <th style={{ textAlign: 'right' }}>{t('customer.total_paid')}</th>
            <th style={{ textAlign: 'right' }}>{t('customer.outstanding')}</th>
            <th style={{ width: 44 }}></th>
          </tr>
        </thead>
        <tbody>
          {customers.length === 0 && <tr><td colSpan={5} className="empty-state">{t('customer.none')}</td></tr>}
          {customers.map(c => (
            <tr key={c.id}>
              <td style={{ fontWeight: 600 }}>{c.name}</td>
              <td style={{ textAlign: 'right' }}>{fmtAmt(c.total_billed)}</td>
              <td style={{ textAlign: 'right', color: '#15803d' }}>{fmtAmt(c.total_paid)}</td>
              <td style={{ textAlign: 'right' }}>
                <BalanceAmount value={c.outstanding} />
              </td>
              <td>
                <button
                  className={`row-menu-btn${menu?.id === c.id ? ' row-menu-btn-active' : ''}`}
                  onClick={e => toggleMenu(e, c.id)}
                  aria-haspopup="menu"
                  aria-expanded={menu?.id === c.id}
                  aria-label={t('common.actions')}
                  title={t('common.actions')}
                >
                  <MoreVertical size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Row action menu. Fixed positioning keeps it above the table instead of being
          clipped by it; it closes on outside click, Escape, scroll or resize. */}
      {menu && (() => {
        const c = customers.find(x => x.id === menu.id)
        if (!c) return null
        return (
          <div
            ref={menuRef}
            className="row-menu"
            role="menu"
            style={{ left: menu.x, top: menu.y, transform: 'translateX(-100%)' }}
          >
            <button role="menuitem" onClick={() => runAction(() => onViewLedger(c))}>
              {t('customer.statement')}
            </button>
            <button role="menuitem" onClick={() => runAction(() => openEdit(c))}>
              {t('common.edit')}
            </button>
            <button role="menuitem" onClick={() => runAction(() => setInfoCustomer(c))}>
              {t('common.info')}
            </button>
            <div className="row-menu-sep" />
            <button
              role="menuitem"
              className="row-menu-danger"
              onClick={() => runAction(() => setDeactivatingId(c.id))}
            >
              {t('customer.archive')}
            </button>
          </div>
        )
      })()}

      {/* Customer info — replaces the Phone column. */}
      {infoCustomer && (
        <div className="confirm-overlay" onClick={() => setInfoCustomer(null)}>
          <div
            className="confirm-modal"
            style={{ width: 420, maxWidth: '94vw' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="confirm-modal-header">
              <span>{infoCustomer.name}</span>
              <button
                onClick={() => setInfoCustomer(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', display: 'flex' }}
                aria-label={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>

            <div className="info-grid">
              <span>{t('common.phone')}</span>
              <span>{infoCustomer.phone || '—'}</span>

              <span>{t('common.address')}</span>
              <span>{infoCustomer.address || '—'}</span>

              <span>{t('biz.pan')}</span>
              <span>{infoCustomer.pan_number || '—'}</span>

              <span>{t('common.notes')}</span>
              <span>{infoCustomer.notes || '—'}</span>

              <span>{t('customer.since')}</span>
              <span>{fmtDate(infoCustomer.created_at)}</span>
            </div>

            <div className="confirm-divider" />

            <div className="info-grid">
              <span>{t('customer.total_billed')}</span>
              <span>{fmtAmt(infoCustomer.total_billed)}</span>

              <span>{t('customer.total_paid')}</span>
              <span style={{ color: '#15803d' }}>{fmtAmt(infoCustomer.total_paid)}</span>

              <span>{t('stock.balance')}</span>
              <span style={{ fontWeight: 700, color: infoCustomer.outstanding > 0.005 ? '#dc2626' : '#15803d' }}>
                {fmtAmt(Math.abs(infoCustomer.outstanding))}
                {infoCustomer.outstanding > 0.005 ? ' Dr.' : infoCustomer.outstanding < -0.005 ? ' Cr.' : ''}
              </span>
            </div>

            <div className="form-actions">
              <button className="btn-ghost btn-sm" onClick={() => { const c = infoCustomer; setInfoCustomer(null); onViewLedger(c) }}>
                {t('customer.statement')}
              </button>
              <button className="btn-ghost btn-sm" onClick={() => { const c = infoCustomer; setInfoCustomer(null); openEdit(c) }}>
                {t('common.edit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

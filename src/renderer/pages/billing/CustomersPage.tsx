import { useEffect, useState } from 'react'
import type { CustomerWithBalance, CustomerStatementEntry, BusinessRow } from '../../../shared/types/api'
import { X } from 'lucide-react'
import { useLanguage } from '../../i18n'

interface FormState { name: string; phone: string; address: string; notes: string }
const EMPTY: FormState = { name: '', phone: '', address: '', notes: '' }

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

  const [businesses, setBusinesses] = useState<BusinessRow[]>([])

  const [statementCustomer, setStatementCustomer] = useState<CustomerWithBalance | null>(null)
  const [statementData, setStatementData] = useState<CustomerStatementEntry[] | null>(null)
  const [statementLoading, setStatementLoading] = useState(false)
  const [statementTab, setStatementTab] = useState<'combined' | number>('combined')

  async function load() {
    const res = search
      ? await window.api.customers.search(search)
      : await window.api.customers.getAll()
    if (res.ok && res.data) setCustomers(res.data)
  }

  useEffect(() => { load() }, [search])

  useEffect(() => {
    window.api.businesses.getAll().then(r => { if (r.ok && r.data) setBusinesses(r.data) })
  }, [])

  function openCreate() {
    setEditingId(null); setForm(EMPTY); setError(''); setShowForm(true)
  }

  function openEdit(c: CustomerWithBalance) {
    setEditingId(c.id)
    setForm({ name: c.name, phone: c.phone ?? '', address: c.address ?? '', notes: c.notes ?? '' })
    setError(''); setShowForm(true)
  }

  function cancel() { setShowForm(false); setEditingId(null); setForm(EMPTY); setError('') }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    setSaving(true)
    try {
      const res = editingId !== null
        ? await window.api.customers.update(editingId, form.name, form.phone || undefined, form.address || undefined, form.notes || undefined)
        : await window.api.customers.create(form.name, form.phone || undefined, form.address || undefined, form.notes || undefined)
      if (!res.ok) { setError(res.error ?? 'Error'); return }
      cancel(); load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setSaving(false)
    }
  }

  async function loadStatement(customerId: number, tab: 'combined' | number) {
    setStatementData(null)
    setStatementLoading(true)
    try {
      const bizId = tab === 'combined' ? undefined : tab
      const res = await window.api.bills.getCustomerStatement(customerId, bizId)
      if (res.ok && res.data) setStatementData(res.data)
      else setStatementData([])
    } finally {
      setStatementLoading(false)
    }
  }

  async function openStatement(c: CustomerWithBalance) {
    setStatementCustomer(c)
    setStatementTab('combined')
    loadStatement(c.id, 'combined')
  }

  async function switchStatementTab(tab: 'combined' | number) {
    setStatementTab(tab)
    if (statementCustomer) loadStatement(statementCustomer.id, tab)
  }

  function withBalance(entries: CustomerStatementEntry[]) {
    let balance = 0
    return entries.map(e => {
      balance += e.debit - e.credit
      return { ...e, balance }
    })
  }

  return (
    <div className="catalog-page">
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

            {businesses.length > 0 && (
              <div className="biz-filter-tabs" style={{ marginBottom: '0.75rem' }}>
                {businesses.map(b => (
                  <button
                    key={b.id}
                    className={`biz-filter-tab${statementTab === b.id ? ' biz-filter-tab-active' : ''}`}
                    onClick={() => switchStatementTab(b.id)}
                  >{b.name}</button>
                ))}
                <button
                  className={`biz-filter-tab${statementTab === 'combined' ? ' biz-filter-tab-active' : ''}`}
                  onClick={() => switchStatementTab('combined')}
                >{t('customer.combined')}</button>
              </div>
            )}

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
                      {statementTab === 'combined' && <th>{t('common.business')}</th>}
                      <th>{t('customer.description')}</th>
                      <th style={{ textAlign: 'right' }}>{t('customer.debit')}</th>
                      <th style={{ textAlign: 'right' }}>{t('customer.credit')}</th>
                      <th style={{ textAlign: 'right' }}>{t('stock.balance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withBalance(statementData).map((e, i) => (
                      <tr key={i}>
                        <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.created_at)}</td>
                        <td>
                          <span className="bill-number-badge" style={{ fontSize: '0.65rem' }}>{e.bill_number}</span>
                        </td>
                        {statementTab === 'combined' && (
                          <td className="text-muted" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{e.business_name}</td>
                        )}
                        <td style={{ maxWidth: 200, lineHeight: 1.3 }}>{e.description}</td>
                        <td style={{ textAlign: 'right', color: e.debit > 0 ? '#1c1917' : '#d4c9bd' }}>
                          {e.debit > 0 ? fmtAmt(e.debit) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', color: e.credit > 0 ? '#15803d' : '#d4c9bd', fontWeight: e.credit > 0 ? 700 : 400 }}>
                          {e.credit > 0 ? fmtAmt(e.credit) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: e.balance > 0 ? '#dc2626' : '#15803d' }}>
                          {fmtAmt(e.balance)}
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
            <th>{t('common.phone')}</th>
            <th style={{ textAlign: 'right' }}>{t('customer.total_billed')}</th>
            <th style={{ textAlign: 'right' }}>{t('customer.total_paid')}</th>
            <th style={{ textAlign: 'right' }}>{t('customer.outstanding')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {customers.length === 0 && <tr><td colSpan={6} className="empty-state">{t('customer.none')}</td></tr>}
          {customers.map(c => (
            <tr key={c.id}>
              <td style={{ fontWeight: 600 }}>{c.name}</td>
              <td className="text-muted">{c.phone ?? '—'}</td>
              <td style={{ textAlign: 'right' }}>{fmtAmt(c.total_billed)}</td>
              <td style={{ textAlign: 'right', color: '#15803d' }}>{fmtAmt(c.total_paid)}</td>
              <td style={{ textAlign: 'right' }}>
                {c.outstanding > 0
                  ? <span className="stock-zero">{fmtAmt(c.outstanding)}</span>
                  : <span className="text-muted">—</span>}
              </td>
              <td className="row-actions">
                <button className="btn-ghost btn-sm" onClick={() => onViewLedger(c)}>{t('customer.statement')}</button>
                <button className="btn-ghost btn-sm" onClick={() => openEdit(c)}>{t('common.edit')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

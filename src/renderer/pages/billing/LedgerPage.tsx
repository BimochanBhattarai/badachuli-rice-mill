import { useEffect, useState } from 'react'
import type {
  CustomerWithBalance,
  CustomerStatementEntry,
  BillWithCustomer,
  BusinessRow,
  AuthUser,
} from '../../../shared/types/api'
import { useLanguage } from '../../i18n'
import { Search, Check, X } from 'lucide-react'

interface Props {
  currentUser: AuthUser
  initialCustomer?: CustomerWithBalance | null
}

const METHODS = [
  { id: 'cash',    label: 'नगद (Cash)' },
  { id: 'bank',    label: 'बैंक (Bank)' },
  { id: 'digital', label: 'डिजिटल (eSewa/IME)' },
] as const

export default function LedgerPage({ currentUser, initialCustomer }: Props) {
  const { t, fmtAmt, fmtDate } = useLanguage()

  const [customers, setCustomers]           = useState<CustomerWithBalance[]>([])
  const [search, setSearch]                 = useState('')
  const [selected, setSelected]             = useState<CustomerWithBalance | null>(null)
  const [businesses, setBusinesses]         = useState<BusinessRow[]>([])
  const [bizFilter, setBizFilter]           = useState<'combined' | number>('combined')

  const [statement, setStatement]           = useState<CustomerStatementEntry[] | null>(null)
  const [stmtLoading, setStmtLoading]       = useState(false)

  const [outstanding, setOutstanding]       = useState<BillWithCustomer[]>([])

  const [collectingId, setCollectingId]     = useState<number | null>(null)
  const [collectAmount, setCollectAmount]   = useState('')
  const [collectMethod, setCollectMethod]   = useState<'cash' | 'bank' | 'digital'>('cash')
  const [collectSaving, setCollectSaving]   = useState(false)
  const [collectError, setCollectError]     = useState('')
  const [collectOk, setCollectOk]           = useState(false)

  useEffect(() => {
    window.api.businesses.getAll().then(r => { if (r.ok && r.data) setBusinesses(r.data) })
    loadCustomers().then(() => {
      if (initialCustomer) selectCustomer(initialCustomer)
    })
  }, [])

  async function loadCustomers(q?: string) {
    const term = q ?? search
    const res = term
      ? await window.api.customers.search(term)
      : await window.api.customers.getAll()
    if (res.ok && res.data) setCustomers(res.data)
  }

  useEffect(() => { loadCustomers(search) }, [search])

  async function selectCustomer(c: CustomerWithBalance) {
    setSelected(c)
    setCollectingId(null)
    setCollectOk(false)
    setBizFilter('combined')
    await Promise.all([loadStatement(c.id, 'combined'), loadOutstanding(c.id)])
  }

  async function loadStatement(customerId: number, tab: 'combined' | number) {
    setStmtLoading(true)
    setStatement(null)
    try {
      const bizId = tab === 'combined' ? undefined : (tab as number)
      const res = await window.api.bills.getCustomerStatement(customerId, bizId)
      setStatement(res.ok && res.data ? res.data : [])
    } finally {
      setStmtLoading(false)
    }
  }

  async function loadOutstanding(customerId: number) {
    const res = await window.api.bills.getAll(500)
    if (res.ok && res.data) {
      setOutstanding(
        res.data.filter(
          b => b.customer_id === customerId && b.due_amount > 0.005 && b.status === 'active'
        )
      )
    }
  }

  async function changeBizFilter(tab: 'combined' | number) {
    setBizFilter(tab)
    if (selected) loadStatement(selected.id, tab)
  }

  function openCollect(bill: BillWithCustomer) {
    setCollectingId(bill.id)
    setCollectAmount('0.00')
    setCollectMethod('cash')
    setCollectError('')
    setCollectOk(false)
  }

  async function submitCollect(bill: BillWithCustomer) {
    const amt = parseFloat(collectAmount)
    if (isNaN(amt) || amt <= 0) { setCollectError('Enter a valid amount'); return }
    setCollectSaving(true); setCollectError('')
    try {
      const res = await window.api.bills.collectPayment(bill.id, amt, collectMethod, currentUser.id)
      if (!res.ok) { setCollectError(res.error ?? 'Error'); return }
      setCollectingId(null)
      setCollectOk(true)
      if (selected) {
        await Promise.all([
          loadStatement(selected.id, bizFilter),
          loadOutstanding(selected.id),
        ])
        const custRes = await window.api.customers.getAll()
        if (custRes.ok && custRes.data) {
          setCustomers(custRes.data)
          const updated = custRes.data.find(c => c.id === selected.id)
          if (updated) setSelected(updated)
        }
      }
    } finally {
      setCollectSaving(false)
    }
  }

  function withBalance(entries: CustomerStatementEntry[]) {
    let bal = 0
    return entries
      .map(e => { bal += e.debit - e.credit; return { ...e, balance: bal } })
      .reverse()
  }

  const showCombinedBizCol = bizFilter === 'combined' && businesses.length > 0

  return (
    <div className="ledger-shell">
      {/* ── Left: customer list ─────────────────────────── */}
      <div className="ledger-list-panel">
        <div className="ledger-list-header">
          <h2 className="ledger-list-title">Customer Ledger</h2>
          <div className="ledger-search-wrap">
            <Search size={13} className="ledger-search-icon" />
            <input
              type="text"
              placeholder={t('customer.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="ledger-search-input"
            />
          </div>
        </div>

        <div className="ledger-list-scroll">
          {customers.length === 0 && (
            <div className="empty-state">{t('customer.none')}</div>
          )}
          {customers.map(c => (
            <button
              key={c.id}
              className={`ledger-customer-row${selected?.id === c.id ? ' ledger-customer-active' : ''}`}
              onClick={() => selectCustomer(c)}
            >
              <span className="ledger-customer-name">{c.name}</span>
              <div className="ledger-customer-meta">
                <span className="ledger-customer-phone">{c.phone ?? ''}</span>
                {c.outstanding > 0.005
                  ? <span className="ledger-outstanding-chip ledger-outstanding-red">{fmtAmt(c.outstanding)}</span>
                  : <span className="ledger-outstanding-chip ledger-outstanding-ok">✓</span>
                }
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: detail ───────────────────────────────── */}
      <div className="ledger-detail-panel">
        {!selected ? (
          <div className="ledger-empty-state">
            <span style={{ fontSize: '2.5rem', opacity: 0.25 }}>📒</span>
            <span>Select a customer to view their ledger</span>
          </div>
        ) : (
          <>
            {/* Customer header */}
            <div className="ledger-detail-header">
              <div>
                <div className="ledger-cust-header-row">
                  <h2 className="ledger-cust-name">{selected.name}</h2>
                  {selected.phone && <span className="ledger-cust-phone">{selected.phone}</span>}
                  {selected.address && <span className="ledger-cust-address">{selected.address}</span>}
                </div>
              </div>
              <div className="ledger-stats-row">
                <div className="ledger-stat">
                  <div className="ledger-stat-label">{t('customer.total_billed')}</div>
                  <div className="ledger-stat-value">{fmtAmt(selected.total_billed)}</div>
                </div>
                <div className="ledger-stat">
                  <div className="ledger-stat-label">{t('customer.total_paid')}</div>
                  <div className="ledger-stat-value" style={{ color: '#15803d' }}>{fmtAmt(selected.total_paid)}</div>
                </div>
                <div className="ledger-stat">
                  <div className="ledger-stat-label">{t('customer.outstanding')}</div>
                  <div
                    className="ledger-stat-value"
                    style={{ color: selected.outstanding > 0.005 ? '#dc2626' : '#15803d' }}
                  >
                    {fmtAmt(selected.outstanding)}
                  </div>
                </div>
              </div>
            </div>

            {/* Biz filter tabs */}
            {businesses.length > 0 && (
              <div className="ledger-biz-tabs">
                <button
                  className={`biz-filter-tab${bizFilter === 'combined' ? ' biz-filter-tab-active' : ''}`}
                  onClick={() => changeBizFilter('combined')}
                >{t('customer.combined')}</button>
                {businesses.map(b => (
                  <button
                    key={b.id}
                    className={`biz-filter-tab${bizFilter === b.id ? ' biz-filter-tab-active' : ''}`}
                    onClick={() => changeBizFilter(b.id)}
                  >{b.name}</button>
                ))}
              </div>
            )}

            {/* Scrollable content */}
            <div className="ledger-detail-scroll">

              {/* Outstanding bills + payment */}
              {outstanding.length > 0 && (
                <div className="ledger-outstanding-card">
                  <div className="ledger-outstanding-card-header">
                    <span>Outstanding Bills — Record Payment</span>
                    {collectOk && (
                      <span className="ledger-collect-ok">
                        <Check size={13} /> Payment recorded
                      </span>
                    )}
                  </div>

                  {outstanding.map(bill => (
                    <div key={bill.id} className="ledger-bill-row">
                      <div className="ledger-bill-row-top">
                        <span className="bill-number-badge" style={{ fontSize: '0.65rem' }}>
                          {bill.bill_number}
                        </span>
                        {businesses.length > 0 && (
                          <span className="ledger-bill-biz">{bill.business_name}</span>
                        )}
                        <span className="ledger-bill-date">{fmtDate(bill.created_at)}</span>
                        <span className="ledger-bill-spacer" />
                        <span className="ledger-bill-total">Total: {fmtAmt(bill.grand_total)}</span>
                        <span className="ledger-bill-due">Due: {fmtAmt(bill.due_amount)}</span>
                        {collectingId === bill.id ? (
                          <button
                            className="btn-ghost btn-sm"
                            onClick={() => setCollectingId(null)}
                            style={{ padding: '0.28rem 0.5rem' }}
                          >
                            <X size={12} />
                          </button>
                        ) : (
                          <button className="btn-primary btn-sm" onClick={() => openCollect(bill)}>
                            Collect
                          </button>
                        )}
                      </div>

                      {collectingId === bill.id && (
                        <div className="ledger-collect-form">
                          <label className="ledger-collect-label">
                            Amount (रु.)
                            <input
                              type="number"
                              value={collectAmount}
                              onChange={e => setCollectAmount(e.target.value)}
                              className="ledger-collect-input"
                              min={0.01}
                              step={0.01}
                              autoFocus
                            />
                          </label>
                          <label className="ledger-collect-label">
                            Method
                            <select
                              value={collectMethod}
                              onChange={e => setCollectMethod(e.target.value as 'cash' | 'bank' | 'digital')}
                              className="ledger-collect-select"
                            >
                              {METHODS.map(m => (
                                <option key={m.id} value={m.id}>{m.label}</option>
                              ))}
                            </select>
                          </label>
                          {collectError && (
                            <span className="form-error" style={{ margin: 0, fontSize: '0.78rem' }}>
                              {collectError}
                            </span>
                          )}
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => submitCollect(bill)}
                            disabled={collectSaving}
                          >
                            {collectSaving ? 'Saving…' : 'Record Payment'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Statement table */}
              <div className="ledger-statement-card">
                <div className="ledger-statement-header">Account Statement</div>

                {stmtLoading ? (
                  <div className="empty-state">{t('customer.loading_statement')}</div>
                ) : !statement || statement.length === 0 ? (
                  <div className="empty-state">{t('customer.no_transactions')}</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th>{t('customer.date_time')}</th>
                          <th>{t('customer.bill_num')}</th>
                          {showCombinedBizCol && <th>{t('common.business')}</th>}
                          <th>{t('customer.description')}</th>
                          <th style={{ textAlign: 'right' }}>{t('customer.debit')} (Dr.)</th>
                          <th style={{ textAlign: 'right' }}>{t('customer.credit')} (Cr.)</th>
                          <th style={{ textAlign: 'right' }}>{t('stock.balance')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withBalance(statement).map((e, i) => (
                          <tr key={i}>
                            <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                              {fmtDate(e.created_at)}
                            </td>
                            <td>
                              <span className="bill-number-badge" style={{ fontSize: '0.65rem' }}>
                                {e.bill_number}
                              </span>
                            </td>
                            {showCombinedBizCol && (
                              <td className="text-muted" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                {e.business_name}
                              </td>
                            )}
                            <td style={{ maxWidth: 280, lineHeight: 1.3 }}>{e.description}</td>
                            <td style={{ textAlign: 'right', color: e.debit > 0 ? '#1c1917' : '#d4c9bd' }}>
                              {e.debit > 0 ? fmtAmt(e.debit) : '—'}
                            </td>
                            <td style={{
                              textAlign: 'right',
                              color: e.credit > 0 ? '#15803d' : '#d4c9bd',
                              fontWeight: e.credit > 0 ? 700 : 400,
                            }}>
                              {e.credit > 0 ? fmtAmt(e.credit) : '—'}
                            </td>
                            <td style={{
                              textAlign: 'right',
                              fontWeight: 800,
                              color: e.balance > 0.005 ? '#dc2626' : '#15803d',
                            }}>
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
          </>
        )}
      </div>
    </div>
  )
}

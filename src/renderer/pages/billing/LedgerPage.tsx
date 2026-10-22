import { useEffect, useRef, useState } from 'react'
import type {
  CustomerWithBalance,
  CustomerStatementEntry,
  BillWithCustomer,
  BillLineWithDetail,
  AuthUser,
} from '../../../shared/types/api'
import { useLanguage } from '../../i18n'
import { Search, X, Info, ChevronDown, ListTree } from 'lucide-react'

interface Props {
  currentUser: AuthUser
  initialCustomer?: CustomerWithBalance | null
  /** Opens the item-wise report sub-page for the selected customer. */
  onViewItemReport?: (customer: CustomerWithBalance) => void
}

const METHODS = [
  { id: 'cash',    label: 'नगद (Cash)' },
  { id: 'digital', label: 'डिजिटल (eSewa/IME)' },
] as const

export default function LedgerPage({ currentUser, initialCustomer, onViewItemReport }: Props) {
  const { t, fmtAmt, fmtDate } = useLanguage()

  const [customers, setCustomers]           = useState<CustomerWithBalance[]>([])
  const [search, setSearch]                 = useState('')
  const [pickerOpen, setPickerOpen]         = useState(false)
  const [selected, setSelected]             = useState<CustomerWithBalance | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const [statement, setStatement]           = useState<CustomerStatementEntry[] | null>(null)
  const [stmtLoading, setStmtLoading]       = useState(false)

  // ── Pay Debt state ──────────────────────────────────────────────────────
  const [payDebtOpen, setPayDebtOpen]             = useState(false)
  const [payDebtAmount, setPayDebtAmount]         = useState('')
  const [payDebtNote, setPayDebtNote]             = useState('')
  const [payDebtMethod, setPayDebtMethod]         = useState<'cash' | 'digital'>('cash')
  const [payDebtSaving, setPayDebtSaving]         = useState(false)
  const [payDebtError, setPayDebtError]           = useState('')
  // Excess-advance confirmation
  const [excessConfirmOpen, setExcessConfirmOpen] = useState(false)
  const [excessConfirmNote, setExcessConfirmNote] = useState('')
  const [pendingPayAmt, setPendingPayAmt]         = useState(0)
  const [pendingPayMethod, setPendingPayMethod]   = useState<'cash' | 'digital'>('cash')

  // ── Advance state ───────────────────────────────────────────────────────
  const [advanceOpen, setAdvanceOpen]       = useState(false)
  const [advanceAmount, setAdvanceAmount]   = useState('')
  const [advanceNote, setAdvanceNote]       = useState('')
  const [advanceMethod, setAdvanceMethod]   = useState<'cash' | 'digital'>('cash')
  const [advanceSaving, setAdvanceSaving]   = useState(false)
  const [advanceError, setAdvanceError]     = useState('')

  // ── Popup state ─────────────────────────────────────────────────────────
  const [popupEntry, setPopupEntry]         = useState<CustomerStatementEntry | null>(null)
  const [popupBill, setPopupBill]           = useState<BillWithCustomer | null>(null)
  const [popupLines, setPopupLines]         = useState<BillLineWithDetail[]>([])
  const [popupLoading, setPopupLoading]     = useState(false)

  useEffect(() => {
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

  // Close the customer picker on outside click
  useEffect(() => {
    if (!pickerOpen) return
    function onDown(ev: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(ev.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [pickerOpen])

  async function selectCustomer(c: CustomerWithBalance) {
    setSelected(c)
    setSearch('')
    setPickerOpen(false)
    setPayDebtOpen(false)
    setAdvanceOpen(false)
    setExcessConfirmOpen(false)
    setPayDebtError('')
    setAdvanceError('')
    await loadStatement(c.id)
  }

  function openPayDebt() {
    setPayDebtAmount('')
    setPayDebtNote('')
    setPayDebtMethod('cash')
    setPayDebtError('')
    setExcessConfirmOpen(false)
    setAdvanceOpen(false)
    setPayDebtOpen(true)
  }

  function openAdvance() {
    setAdvanceAmount('')
    setAdvanceNote('')
    setAdvanceMethod('cash')
    setAdvanceError('')
    setPayDebtOpen(false)
    setExcessConfirmOpen(false)
    setAdvanceOpen(true)
  }

  async function reloadAfterPayment() {
    if (!selected) return
    await loadStatement(selected.id)
    const custRes = await window.api.customers.getAll()
    if (custRes.ok && custRes.data) {
      setCustomers(custRes.data)
      const updated = custRes.data.find(c => c.id === selected.id)
      if (updated) setSelected(updated)
    }
  }

  async function submitPayDebt() {
    if (!selected) return
    const amt = parseFloat(payDebtAmount)
    if (isNaN(amt) || amt <= 0) { setPayDebtError('Enter a valid amount'); return }

    const outstanding = Math.max(0, selected.outstanding)
    if (amt > outstanding + 0.005) {
      // Show excess advance confirmation
      setPendingPayAmt(amt)
      setPendingPayMethod(payDebtMethod)
      setExcessConfirmNote('')
      setExcessConfirmOpen(true)
      return
    }

    await doPayDebt(amt, payDebtMethod, payDebtNote || undefined)
  }

  async function doPayDebt(amt: number, method: 'cash' | 'digital', note?: string) {
    setPayDebtSaving(true)
    setPayDebtError('')
    try {
      const res = await window.api.customers.receivePayment(selected!.id, amt, method, currentUser.id, note)
      if (!res.ok) { setPayDebtError(res.error ?? 'Error'); return }
      setPayDebtOpen(false)
      setExcessConfirmOpen(false)
      await reloadAfterPayment()
    } finally {
      setPayDebtSaving(false)
    }
  }

  async function confirmExcessAdvance() {
    await doPayDebt(pendingPayAmt, pendingPayMethod, excessConfirmNote || undefined)
  }

  async function submitAdvance() {
    if (!selected) return
    const amt = parseFloat(advanceAmount)
    if (isNaN(amt) || amt <= 0) { setAdvanceError('Enter a valid amount'); return }
    setAdvanceSaving(true)
    setAdvanceError('')
    try {
      // Same call as a normal payment: an "advance" is just a payment that leaves
      // the balance negative.
      const res = await window.api.customers.receivePayment(
        selected.id, amt, advanceMethod, currentUser.id, advanceNote || undefined
      )
      if (!res.ok) { setAdvanceError(res.error ?? 'Error'); return }
      setAdvanceOpen(false)
      await reloadAfterPayment()
    } finally {
      setAdvanceSaving(false)
    }
  }

  async function openPopup(entry: CustomerStatementEntry) {
    if (!entry.bill_id) return
    setPopupEntry(entry)
    setPopupBill(null)
    setPopupLines([])
    setPopupLoading(true)
    try {
      const [billRes, linesRes] = await Promise.all([
        window.api.bills.getById(entry.bill_id),
        window.api.bills.getLines(entry.bill_id),
      ])
      if (billRes.ok && billRes.data) setPopupBill(billRes.data)
      if (linesRes.ok && linesRes.data) setPopupLines(linesRes.data)
    } finally {
      setPopupLoading(false)
    }
  }

  function closePopup() { setPopupEntry(null); setPopupBill(null); setPopupLines([]) }

  async function loadStatement(customerId: number) {
    setStmtLoading(true)
    setStatement(null)
    try {
      const res = await window.api.bills.getCustomerStatement(customerId)
      setStatement(res.ok && res.data ? res.data : [])
    } finally {
      setStmtLoading(false)
    }
  }

  // The running balance is server-computed (ledger.balance_after) and frozen at write
  // time, so it is never re-accumulated here. Display newest-first.
  function newestFirst(entries: CustomerStatementEntry[]) {
    return [...entries].reverse()
  }


  // Shared inline form style
  const formCardStyle = (color: string): React.CSSProperties => ({
    marginTop: '0.75rem',
    background: color === 'orange' ? '#fef9f0' : '#f0fdf4',
    border: `1px solid ${color === 'orange' ? '#f5c77e' : '#86efac'}`,
    borderRadius: 10,
    padding: '0.9rem 1rem',
  })

  return (
    <div className="ledger-shell ledger-shell-full">
      {/* ── Customer picker bar ─────────────────────────── */}
      <div className="ledger-picker-bar">
        <h2 className="ledger-list-title" style={{ margin: 0, flexShrink: 0 }}>Customer Ledger</h2>
        <div className="ledger-picker" ref={pickerRef}>
          <div className="ledger-search-wrap">
            <Search size={14} className="ledger-search-icon" />
            <input
              type="text"
              placeholder={selected ? `${selected.name} — search to switch…` : t('customer.search')}
              value={search}
              onChange={e => { setSearch(e.target.value); setPickerOpen(true) }}
              onFocus={() => setPickerOpen(true)}
              className="ledger-search-input ledger-picker-input"
            />
            <ChevronDown size={15} className="ledger-picker-caret" />
          </div>

          {pickerOpen && (
            <div className="ledger-picker-dropdown">
              {customers.length === 0 ? (
                <div className="empty-state" style={{ padding: '1rem' }}>{t('customer.none')}</div>
              ) : (
                customers.map(c => (
                  <button
                    key={c.id}
                    className={`ledger-picker-row${selected?.id === c.id ? ' ledger-customer-active' : ''}`}
                    onClick={() => selectCustomer(c)}
                  >
                    <div className="ledger-picker-row-main">
                      <span className="ledger-customer-name">{c.name}</span>
                      {c.phone && <span className="ledger-customer-phone">{c.phone}</span>}
                    </div>
                    {c.outstanding > 0.005
                      ? <span className="ledger-outstanding-chip ledger-outstanding-red">{fmtAmt(c.outstanding)}</span>
                      : c.outstanding < -0.005
                        ? <span className="ledger-outstanding-chip ledger-outstanding-ok">Cr. {fmtAmt(Math.abs(c.outstanding))}</span>
                        : <span className="ledger-outstanding-chip ledger-outstanding-ok">✓</span>
                    }
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Transaction detail popup ────────────────────── */}
      {popupEntry && (
        <div className="ledger-popup-overlay" onClick={closePopup}>
          <div className="ledger-popup" onClick={e => e.stopPropagation()}>
            <div className="ledger-popup-header">
              <div>
                {popupEntry.bill_number && (
                  <span className="bill-number-badge" style={{ fontSize: '0.7rem' }}>{popupEntry.bill_number}</span>
                )}
                <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#78716c' }}>{fmtDate(popupEntry.created_at)}</span>
                {popupBill && (
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#a8a29e' }}>
                    {popupBill.business_name} · {
                      popupBill.bill_kind === 'mixed'
                        ? 'Sale + Processing'
                        : popupBill.bill_kind === 'processing' ? 'Processing' : 'Sale'
                    }
                  </span>
                )}
              </div>
              <button className="ledger-popup-close" onClick={closePopup}><X size={15} /></button>
            </div>

            {popupLoading ? (
              <div className="empty-state" style={{ padding: '2rem' }}>Loading…</div>
            ) : (
              <div className="ledger-popup-body">
                {(popupEntry.kind === 'payment' || popupEntry.kind === 'loan_repayment') && (
                  <div className="ledger-popup-section">
                    <div className="ledger-popup-section-title">
                      {popupEntry.kind === 'loan_repayment' ? 'Loan Repayment' : 'Payment'}
                    </div>
                    <div className="ledger-popup-row">
                      <span>Amount</span>
                      <span style={{ fontWeight: 700, color: '#15803d' }}>{fmtAmt(popupEntry.credit)}</span>
                    </div>
                    <div className="ledger-popup-row">
                      <span>Description</span>
                      <span>{popupEntry.description}</span>
                    </div>
                  </div>
                )}

                {popupLines.length > 0 && (
                  <div className="ledger-popup-section">
                    <div className="ledger-popup-section-title">Items</div>
                    <table className="data-table" style={{ fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Rate</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {popupLines.map(l => (
                          <tr key={l.id}>
                            <td>
                              {l.item_name}
                              {l.variant_name && l.variant_name !== l.item_name && (
                                <span className="text-muted"> ({l.variant_name})</span>
                              )}
                              {l.line_type === 'processing' && (
                                <span style={{ marginLeft: '0.3rem', fontSize: '0.65rem', padding: '1px 4px', borderRadius: '3px', background: '#fef3c7', color: '#92400e' }}>
                                  Processing
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>{l.qty} {l.unit_abbreviation}</td>
                            <td style={{ textAlign: 'right' }}>{fmtAmt(l.rate_snapshot)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtAmt(l.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {popupBill && (
                  <div className="ledger-popup-section">
                    <div className="ledger-popup-section-title">Bill Summary</div>
                    <div className="ledger-popup-row">
                      <span>Total</span>
                      <span style={{ fontWeight: 700 }}>{fmtAmt(popupBill.grand_total)}</span>
                    </div>
                    <div className="ledger-popup-row">
                      <span>Paid</span>
                      <span style={{ color: '#15803d', fontWeight: 600 }}>{fmtAmt(popupBill.paid_amount)}</span>
                    </div>
                    {popupBill.credit_amount > 0.005 && (
                      <div className="ledger-popup-row">
                        <span>On credit</span>
                        <span style={{ color: '#dc2626', fontWeight: 700 }}>{fmtAmt(popupBill.credit_amount)}</span>
                      </div>
                    )}
                    {popupBill.notes && (
                      <div className="ledger-popup-row">
                        <span>Notes</span>
                        <span className="text-muted" style={{ fontSize: '0.78rem' }}>{popupBill.notes}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Excess advance confirmation modal ──────────── */}
      {excessConfirmOpen && selected && (
        <div className="ledger-popup-overlay" onClick={() => setExcessConfirmOpen(false)}>
          <div className="ledger-popup" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="ledger-popup-header">
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Record as Advance?</span>
              <button className="ledger-popup-close" onClick={() => setExcessConfirmOpen(false)}><X size={15} /></button>
            </div>
            <div className="ledger-popup-body">
              <p style={{ fontSize: '0.85rem', color: '#57534e', marginBottom: '1rem', lineHeight: 1.5 }}>
                <strong>{fmtAmt(pendingPayAmt)}</strong> exceeds the outstanding balance of{' '}
                <strong>{fmtAmt(Math.max(0, selected.outstanding))}</strong>. The excess{' '}
                <strong style={{ color: '#15803d' }}>
                  {fmtAmt(pendingPayAmt - Math.max(0, selected.outstanding))}
                </strong>{' '}
                will be recorded as an advance credit.
              </p>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 600, color: '#57534e' }}>
                Note (optional)
                <input
                  type="text"
                  value={excessConfirmNote}
                  onChange={e => setExcessConfirmNote(e.target.value)}
                  placeholder="e.g. October prepayment"
                  className="ledger-collect-input"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && confirmExcessAdvance()}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="btn-ghost btn-sm" onClick={() => setExcessConfirmOpen(false)}>Cancel</button>
                <button className="btn-primary btn-sm" onClick={confirmExcessAdvance} disabled={payDebtSaving}>
                  {payDebtSaving ? 'Saving…' : 'Confirm & Record'}
                </button>
              </div>
              {payDebtError && (
                <span className="form-error" style={{ marginTop: '0.4rem', fontSize: '0.78rem' }}>{payDebtError}</span>
              )}
            </div>
          </div>
        </div>
      )}

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
                    {selected.outstanding < -0.005
                      ? `Credit: ${fmtAmt(Math.abs(selected.outstanding))}`
                      : fmtAmt(selected.outstanding)
                    }
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.4rem', alignSelf: 'center', marginLeft: '0.5rem' }}>
                  {onViewItemReport && (
                    <button
                      className="btn-sm ledger-report-btn"
                      onClick={() => onViewItemReport(selected)}
                      title={t('citem.title')}
                    >
                      <ListTree size={13} />
                      {t('customer.item_report')}
                    </button>
                  )}
                  <button
                    className={payDebtOpen ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'}
                    onClick={payDebtOpen ? () => setPayDebtOpen(false) : openPayDebt}
                  >
                    {payDebtOpen ? <X size={13} /> : 'Pay Debt'}
                  </button>
                  {selected.outstanding <= 0.005 && (
                    <button
                      className={advanceOpen ? 'btn-ghost btn-sm' : 'btn-sm'}
                      style={advanceOpen ? {} : { background: '#dcfce7', color: '#15803d', border: '1.5px solid #86efac', fontWeight: 700 }}
                      onClick={advanceOpen ? () => setAdvanceOpen(false) : openAdvance}
                    >
                      {advanceOpen ? <X size={13} /> : 'Advance'}
                    </button>
                  )}
                </div>
              </div>

              {/* Pay Debt inline form */}
              {payDebtOpen && (
                <div style={formCardStyle('orange')}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.6rem', color: '#92400e' }}>
                    Record Debt Payment
                    {selected.outstanding > 0.005 && (
                      <span style={{ fontWeight: 400, marginLeft: '0.5rem', color: '#a8a29e' }}>
                        Outstanding: {fmtAmt(selected.outstanding)}
                      </span>
                    )}
                    {selected.outstanding <= 0.005 && (
                      <span style={{ fontWeight: 400, marginLeft: '0.5rem', color: '#15803d' }}>
                        No outstanding — excess will be saved as advance
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <label className="ledger-collect-label" style={{ flex: '1 1 110px' }}>
                      Amount (रु.)
                      <input
                        type="number"
                        value={payDebtAmount}
                        onChange={e => setPayDebtAmount(e.target.value)}
                        className="ledger-collect-input"
                        min={0.01}
                        step={0.01}
                        placeholder="0"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && submitPayDebt()}
                      />
                    </label>
                    <label className="ledger-collect-label" style={{ flex: '1 1 140px' }}>
                      Method
                      <select
                        value={payDebtMethod}
                        onChange={e => setPayDebtMethod(e.target.value as 'cash' | 'digital')}
                        className="ledger-collect-select"
                      >
                        {METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </label>
                    <label className="ledger-collect-label" style={{ flex: '2 1 180px' }}>
                      Note (optional)
                      <input
                        type="text"
                        value={payDebtNote}
                        onChange={e => setPayDebtNote(e.target.value)}
                        className="ledger-collect-input"
                        placeholder="e.g. Cash received 20 Ashwin"
                      />
                    </label>
                    <button
                      className="btn-primary btn-sm"
                      onClick={submitPayDebt}
                      disabled={payDebtSaving}
                      style={{ flexShrink: 0 }}
                    >
                      {payDebtSaving ? 'Saving…' : 'Record Payment'}
                    </button>
                  </div>
                  {payDebtError && (
                    <span className="form-error" style={{ margin: '0.4rem 0 0', fontSize: '0.78rem' }}>
                      {payDebtError}
                    </span>
                  )}
                </div>
              )}

              {/* Advance inline form */}
              {advanceOpen && (
                <div style={formCardStyle('green')}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.6rem', color: '#15803d' }}>
                    Record Advance Payment
                    <span style={{ fontWeight: 400, marginLeft: '0.5rem', color: '#a8a29e', fontSize: '0.8rem' }}>
                      Credited to customer's account
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <label className="ledger-collect-label" style={{ flex: '1 1 110px' }}>
                      Amount (रु.)
                      <input
                        type="number"
                        value={advanceAmount}
                        onChange={e => setAdvanceAmount(e.target.value)}
                        className="ledger-collect-input"
                        min={0.01}
                        step={0.01}
                        placeholder="0"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && submitAdvance()}
                      />
                    </label>
                    <label className="ledger-collect-label" style={{ flex: '1 1 140px' }}>
                      Method
                      <select
                        value={advanceMethod}
                        onChange={e => setAdvanceMethod(e.target.value as 'cash' | 'digital')}
                        className="ledger-collect-select"
                      >
                        {METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </label>
                    <label className="ledger-collect-label" style={{ flex: '2 1 180px' }}>
                      Note (optional)
                      <input
                        type="text"
                        value={advanceNote}
                        onChange={e => setAdvanceNote(e.target.value)}
                        className="ledger-collect-input"
                        placeholder="e.g. October prepayment"
                      />
                    </label>
                    <button
                      className="btn-sm"
                      style={{ background: '#15803d', color: '#fff', border: 'none', flexShrink: 0, fontWeight: 700 }}
                      onClick={submitAdvance}
                      disabled={advanceSaving}
                    >
                      {advanceSaving ? 'Saving…' : 'Record Advance'}
                    </button>
                  </div>
                  {advanceError && (
                    <span className="form-error" style={{ margin: '0.4rem 0 0', fontSize: '0.78rem' }}>
                      {advanceError}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* No business tabs here: the balance is ONE global figure per customer,
                so a business-filtered statement would show a Balance column that
                accumulates to nothing. The Business column below still shows which
                business each sale belonged to. */}
            {/* Statement table */}
            <div className="ledger-detail-scroll">
              <div className="ledger-statement-card">
                <div className="ledger-statement-header">Account Statement</div>

                {stmtLoading ? (
                  <div className="empty-state">{t('customer.loading_statement')}</div>
                ) : !statement || statement.length === 0 ? (
                  <div className="empty-state">{t('customer.no_transactions')}</div>
                ) : (
                  <div className="ledger-statement-scroll">
                    <table className="data-table" style={{ fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th>{t('customer.date_time')}</th>
                          <th>Description</th>
                          <th style={{ textAlign: 'right' }}>{t('customer.debit')} (Dr.)</th>
                          <th style={{ textAlign: 'right' }}>{t('customer.credit')} (Cr.)</th>
                          <th style={{ textAlign: 'right' }}>{t('stock.balance')}</th>
                          <th style={{ width: 36 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {newestFirst(statement).map((e, i) => {
                          // The ledger stores what each row IS, so no inference is needed.
                          // (This used to guess "advance vs payment" from the sign of a
                          // client-accumulated balance.)
                          const isCredit = e.credit > 0.005
                          const label = e.description
                          const canOpenPopup = !!e.bill_id && e.kind === 'sale'
                          return (
                            <tr key={i} style={isCredit ? { background: '#f0fdf4' } : undefined}>
                              <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                                {fmtDate(e.created_at)}
                              </td>
                              <td style={{ fontSize: '0.78rem', color: '#57534e', maxWidth: 200 }}>
                                {isCredit
                                  ? <span style={{ color: '#15803d', fontWeight: 600 }}>{label}</span>
                                  : label
                                }
                              </td>
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
                              <td style={{ textAlign: 'center' }}>
                                {canOpenPopup && (
                                  <button
                                    className="ledger-info-btn"
                                    onClick={() => openPopup(e)}
                                    title="View details"
                                  >
                                    <Info size={13} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
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

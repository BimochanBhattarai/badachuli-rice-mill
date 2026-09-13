import { useEffect, useState } from 'react'
import type {
  AuthUser, BillWithCustomer, BillLineWithDetail, PaymentRow, CustomerWithBalance, BusinessRow,
} from '../../../shared/types/api'
import PrintReceipt from '../../components/PrintReceipt'
import { useLanguage } from '../../i18n'

export interface AmendData {
  customer: CustomerWithBalance | null
  lines: BillLineWithDetail[]
  notes: string
}

interface Props {
  currentUser: AuthUser
  onAmend: (data: AmendData) => void
}

export default function BillsPage({ currentUser, onAmend }: Props) {
  const { t, fmtAmt, fmtDate } = useLanguage()
  const [bills, setBills] = useState<BillWithCustomer[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [linesCache, setLinesCache] = useState<Record<number, BillLineWithDetail[]>>({})
  const [paymentsCache, setPaymentsCache] = useState<Record<number, PaymentRow[]>>({})
  const [collectingId, setCollectingId] = useState<number | null>(null)
  const [collectAmount, setCollectAmount] = useState('')
  const [collectMethod, setCollectMethod] = useState('cash')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [amendingBill, setAmendingBill] = useState<BillWithCustomer | null>(null)
  const [amendReason, setAmendReason] = useState('')
  const [amendError, setAmendError] = useState('')
  const [amendSaving, setAmendSaving] = useState(false)

  const [printBill, setPrintBill] = useState<BillWithCustomer | null>(null)
  const [printLines, setPrintLines] = useState<BillLineWithDetail[]>([])
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [businessFilter, setBusinessFilter] = useState<number | null>(null)

  async function load() {
    const res = await window.api.bills.getAll(100, businessFilter ?? undefined)
    if (res.ok && res.data) setBills(res.data)
  }

  useEffect(() => {
    window.api.businesses.getAll().then(r => { if (r.ok && r.data) setBusinesses(r.data) })
  }, [])

  useEffect(() => { load() }, [businessFilter])

  async function toggleExpand(bill: BillWithCustomer) {
    if (expandedId === bill.id) { setExpandedId(null); return }
    setExpandedId(bill.id)
    const fetches: Promise<void>[] = []
    if (!linesCache[bill.id]) {
      fetches.push(
        window.api.bills.getLines(bill.id).then(res => {
          if (res.ok && res.data) setLinesCache(prev => ({ ...prev, [bill.id]: res.data! }))
        })
      )
    }
    if (!paymentsCache[bill.id]) {
      fetches.push(
        window.api.bills.getPayments(bill.id).then(res => {
          if (res.ok && res.data) setPaymentsCache(prev => ({ ...prev, [bill.id]: res.data! }))
        })
      )
    }
    await Promise.all(fetches)
  }

  function openCollect(bill: BillWithCustomer) {
    setCollectingId(bill.id)
    setCollectAmount(String(bill.due_amount.toFixed(2)))
    setCollectMethod('cash')
    setError('')
  }

  async function openPrint(bill: BillWithCustomer) {
    let billLines = linesCache[bill.id]
    if (!billLines) {
      const res = await window.api.bills.getLines(bill.id)
      billLines = res.data ?? []
      setLinesCache(prev => ({ ...prev, [bill.id]: billLines }))
    }
    setPrintBill(bill)
    setPrintLines(billLines)
  }

  async function submitCollect(bill: BillWithCustomer) {
    const amt = parseFloat(collectAmount)
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    try {
      const res = await window.api.bills.collectPayment(bill.id, amt, collectMethod, currentUser.id)
      if (!res.ok) { setError(res.error ?? 'Error'); return }
      setCollectingId(null)
      setPaymentsCache(prev => { const n = { ...prev }; delete n[bill.id]; return n })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setSaving(false)
    }
  }

  async function submitAmend() {
    if (!amendingBill || !amendReason.trim()) { setAmendError('Reason is required'); return }
    setAmendSaving(true); setAmendError('')
    try {
      const cancelRes = await window.api.bills.cancel(amendingBill.id, amendReason.trim(), currentUser.id)
      if (!cancelRes.ok) { setAmendError(cancelRes.error ?? 'Cancel failed'); return }

      let lines = linesCache[amendingBill.id]
      if (!lines) {
        const lRes = await window.api.bills.getLines(amendingBill.id)
        lines = lRes.data ?? []
      }

      let customer: CustomerWithBalance | null = null
      if (amendingBill.customer_id) {
        const cRes = await window.api.customers.getById(amendingBill.customer_id)
        if (cRes.ok && cRes.data) customer = cRes.data
      }

      setAmendingBill(null)
      setAmendReason('')
      load()

      onAmend({
        customer,
        lines,
        notes: `Amends ${amendingBill.bill_number}`,
      })
    } catch (err) {
      setAmendError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setAmendSaving(false)
    }
  }

  const collectMethodLabels: Record<string, string> = {
    cash: t('bill.cash'),
    bank: t('bill.bank'),
    digital: t('bill.digital'),
  }

  return (
    <div className="catalog-page">
      {printBill && businesses.length > 0 && (
        <PrintReceipt
          bill={printBill}
          lines={printLines}
          business={businesses.find(b => b.id === printBill.business_id) ?? businesses[0]}
          onClose={() => setPrintBill(null)}
        />
      )}

      {amendingBill && (
        <div className="confirm-overlay">
          <div className="confirm-modal" style={{ maxWidth: 440 }}>
            <div className="confirm-modal-header">
              <span>{t('bill.amend_title')} {amendingBill.bill_number}</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#78716c', lineHeight: 1.5 }}>
              {t('bill.amend_note')}
            </p>
            <label style={{ marginBottom: 0 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#44403c' }}>{t('bill.amend_reason_label')}</span>
              <textarea
                rows={3}
                style={{
                  width: '100%', marginTop: '0.35rem',
                  border: '1.5px solid #d6cfc7', borderRadius: 8,
                  padding: '0.5rem 0.75rem', fontSize: '0.875rem',
                  fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                  background: '#fafaf9',
                }}
                placeholder="e.g. Wrong quantity entered"
                value={amendReason}
                onChange={e => setAmendReason(e.target.value)}
                autoFocus
              />
            </label>
            {amendError && <div className="form-error">{amendError}</div>}
            <div className="confirm-actions">
              <button className="btn-primary" onClick={submitAmend} disabled={amendSaving}>
                {amendSaving ? t('common.saving') : t('bill.cancel_reissue')}
              </button>
              <button className="btn-ghost" onClick={() => { setAmendingBill(null); setAmendReason(''); setAmendError('') }}>
                {t('bill.go_back')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="catalog-header">
        <h2>{t('nav.bills')}</h2>
        <span className="text-muted" style={{ fontSize: '0.85rem' }}>
          {t('bill.last_bills').replace('{n}', String(bills.length))}
        </span>
      </div>

      {businesses.length > 0 && (
        <div className="biz-filter-tabs">
          <button
            className={`biz-filter-tab${businessFilter === null ? ' biz-filter-tab-active' : ''}`}
            onClick={() => setBusinessFilter(null)}
          >{t('common.all')}</button>
          {businesses.map(b => (
            <button
              key={b.id}
              className={`biz-filter-tab${businessFilter === b.id ? ' biz-filter-tab-active' : ''}`}
              onClick={() => setBusinessFilter(b.id)}
            >{b.name}</button>
          ))}
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>{t('bill.number')}</th>
            <th>{t('common.date')}</th>
            <th>{t('common.business')}</th>
            <th>{t('common.type')}</th>
            <th>{t('bill.customer')}</th>
            <th style={{ textAlign: 'right' }}>{t('bill.total')}</th>
            <th style={{ textAlign: 'right' }}>{t('bill.paid')}</th>
            <th style={{ textAlign: 'right' }}>{t('bill.due')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bills.length === 0 && (
            <tr><td colSpan={9} className="empty-state">{t('bill.no_bills')}</td></tr>
          )}
          {bills.map(bill => (
            <BillRow
              key={bill.id}
              bill={bill}
              expanded={expandedId === bill.id}
              lines={linesCache[bill.id]}
              payments={paymentsCache[bill.id]}
              collecting={collectingId === bill.id}
              collectAmount={collectAmount}
              collectMethod={collectMethod}
              collectMethodLabels={collectMethodLabels}
              saving={saving}
              error={error}
              onToggle={() => toggleExpand(bill)}
              onOpenCollect={() => openCollect(bill)}
              onCancelCollect={() => { setCollectingId(null); setError('') }}
              onAmountChange={setCollectAmount}
              onMethodChange={setCollectMethod}
              onSubmitCollect={() => submitCollect(bill)}
              onPrint={() => openPrint(bill)}
              onAmend={() => { setAmendingBill(bill); setAmendReason(''); setAmendError('') }}
              t={t}
              fmtAmt={fmtAmt}
              fmtDate={fmtDate}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface BillRowProps {
  bill: BillWithCustomer
  expanded: boolean
  lines: BillLineWithDetail[] | undefined
  payments: PaymentRow[] | undefined
  collecting: boolean
  collectAmount: string
  collectMethod: string
  collectMethodLabels: Record<string, string>
  saving: boolean
  error: string
  onToggle: () => void
  onOpenCollect: () => void
  onCancelCollect: () => void
  onAmountChange: (v: string) => void
  onMethodChange: (v: string) => void
  onSubmitCollect: () => void
  onPrint: () => void
  onAmend: () => void
  t: (key: string) => string
  fmtAmt: (n: number) => string
  fmtDate: (s: string) => string
}

function BillRow({
  bill, expanded, lines, payments, collecting,
  collectAmount, collectMethod, collectMethodLabels, saving, error,
  onToggle, onOpenCollect, onCancelCollect,
  onAmountChange, onMethodChange, onSubmitCollect, onPrint, onAmend,
  t, fmtAmt, fmtDate,
}: BillRowProps) {
  const typeBadge = bill.bill_type === 'processing'
    ? <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>{t('bill.processing_badge')}</span>
    : <span className="badge badge-finished">{t('bill.sale_badge')}</span>

  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={onToggle}>
        <td><span className="bill-number-badge">{bill.bill_number}</span></td>
        <td className="text-muted">{fmtDate(bill.created_at)}</td>
        <td className="text-muted" style={{ fontSize: '0.8rem' }}>{bill.business_name}</td>
        <td>{typeBadge}</td>
        <td>{bill.customer_name ?? <span className="text-muted">{t('bill.walk_in')}</span>}</td>
        <td style={{ textAlign: 'right' }}>{fmtAmt(bill.grand_total)}</td>
        <td style={{ textAlign: 'right' }}>{fmtAmt(bill.paid_amount)}</td>
        <td style={{ textAlign: 'right' }}>
          {bill.due_amount > 0
            ? <span className="outstanding-warn">{fmtAmt(bill.due_amount)}</span>
            : <span className="text-muted">—</span>}
        </td>
        <td className="row-actions" onClick={e => e.stopPropagation()}>
          {bill.due_amount > 0 && (
            <button className="btn-primary btn-sm" onClick={onOpenCollect}>{t('bill.collect')}</button>
          )}
          <button className="btn-ghost btn-sm" onClick={onPrint} title={t('bill.print')}>🖨</button>
          {bill.status === 'active' && (
            <button className="btn-ghost btn-sm" onClick={onAmend} title={t('bill.amend')} style={{ color: '#ea580c', borderColor: '#fb923c' }}>
              {t('bill.amend')}
            </button>
          )}
          <button className="btn-ghost btn-sm" onClick={onToggle}>{expanded ? '▲' : '▼'}</button>
        </td>
      </tr>

      {collecting && (
        <tr>
          <td colSpan={9} style={{ padding: 0 }}>
            <div className="collect-form">
              <span style={{ fontWeight: 600 }}>{t('bill.collecting')} — {bill.bill_number}</span>
              <label>
                {t('bill.paid')} (Rs.)
                <input
                  type="number" step="0.01" min="0.01"
                  value={collectAmount}
                  onChange={e => onAmountChange(e.target.value)}
                  autoFocus
                />
              </label>
              <label>
                {t('bill.method')}
                <select value={collectMethod} onChange={e => onMethodChange(e.target.value)}>
                  {(['cash', 'bank', 'digital'] as const).map(m => (
                    <option key={m} value={m}>{collectMethodLabels[m]}</option>
                  ))}
                </select>
              </label>
              {error && <span className="form-error">{error}</span>}
              <div className="form-actions">
                <button className="btn-primary btn-sm" onClick={onSubmitCollect} disabled={saving}>
                  {saving ? t('common.saving') : t('bill.collect')}
                </button>
                <button className="btn-ghost btn-sm" onClick={onCancelCollect}>{t('common.cancel')}</button>
              </div>
            </div>
          </td>
        </tr>
      )}

      {expanded && (
        <tr>
          <td colSpan={9} style={{ padding: 0 }}>
            <div style={{ padding: '0.75rem 1.5rem 1rem', background: '#faf8f5' }}>
              <div className="bill-expand-section-label">{t('bill.line_items')}</div>
              <table className="data-table" style={{ marginTop: '0.35rem' }}>
                <thead>
                  <tr>
                    <th>{t('bill.item')}</th>
                    <th style={{ textAlign: 'right' }}>{t('bill.qty')}</th>
                    <th style={{ textAlign: 'right' }}>{t('bill.rate')}</th>
                    <th style={{ textAlign: 'right' }}>{t('bill.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {!lines && (
                    <tr><td colSpan={4} className="empty-state">{t('common.loading')}</td></tr>
                  )}
                  {lines?.map(l => (
                    <tr key={l.id}>
                      <td>
                        {l.item_name}
                        {l.variant_name && l.variant_name !== l.item_name && (
                          <span className="text-muted"> · {l.variant_name}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>{l.qty} {l.unit_abbreviation}</td>
                      <td style={{ textAlign: 'right' }}>{fmtAmt(l.rate_snapshot)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtAmt(l.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bill-expand-section-label" style={{ marginTop: '1rem' }}>{t('bill.payment_history')}</div>
              {!payments ? (
                <div className="empty-state" style={{ padding: '0.5rem', textAlign: 'left' }}>{t('common.loading')}</div>
              ) : payments.length === 0 ? (
                <div className="empty-state" style={{ padding: '0.5rem', textAlign: 'left' }}>{t('bill.no_payments')}</div>
              ) : (
                <div className="payment-timeline">
                  {payments.map(p => (
                    <div key={p.id} className="payment-timeline-row">
                      <div className="payment-timeline-dot" />
                      <div className="payment-timeline-content">
                        <span className="payment-timeline-method">{p.method}</span>
                        <span className="payment-timeline-date">{fmtDate(p.created_at)}</span>
                      </div>
                      <span className="payment-timeline-amount">{fmtAmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

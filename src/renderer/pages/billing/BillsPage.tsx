import { useEffect, useState } from 'react'
import type {
  AuthUser, BillWithCustomer, BillLineWithDetail, LedgerEntryView, CustomerWithBalance, BusinessRow,
} from '../../../shared/types/api'
import PrintReceipt from '../../components/PrintReceipt'
import { useLanguage, formatDateBSEn } from '../../i18n'

export interface AmendData {
  customer: CustomerWithBalance | null
  lines: BillLineWithDetail[]
  notes: string
  paidAmount: number
  amendsBillId: number
}

interface Props {
  currentUser: AuthUser
  onAmend: (data: AmendData) => void
}

// ── Nepal date helpers ────────────────────────────────────────
function todayNepal(): string {
  return new Date(Date.now() + 345 * 60 * 1000).toISOString().slice(0, 10)
}
function addDay(d: string, n: number): string {
  const dt = new Date(d + 'T12:00:00Z')
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}
function nepalDayUTCRange(d: string) {
  // Nepal midnight = previous UTC day 18:15 → current UTC day 18:15 (exclusive)
  return { from: addDay(d, -1) + ' 18:15:00', to: d + ' 18:15:00' }
}

const PAGE_SIZE = 20

export default function BillsPage({ currentUser, onAmend }: Props) {
  const { t, fmtAmt, fmtDate } = useLanguage()
  const [bills, setBills] = useState<BillWithCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [linesCache, setLinesCache] = useState<Record<number, BillLineWithDetail[]>>({})
  const [paymentsCache, setPaymentsCache] = useState<Record<number, LedgerEntryView[]>>({})

  const [amendingBill, setAmendingBill] = useState<BillWithCustomer | null>(null)
  const [amendReason, setAmendReason] = useState('')
  const [amendError, setAmendError] = useState('')
  const [amendSaving, setAmendSaving] = useState(false)

  const [printBill, setPrintBill] = useState<BillWithCustomer | null>(null)
  const [printLines, setPrintLines] = useState<BillLineWithDetail[]>([])
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [businessFilter, setBusinessFilter] = useState<number | null>(null)
  const [showCancelled, setShowCancelled] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayNepal)
  const [page, setPage] = useState(0)

  const today = todayNepal()
  const isToday = selectedDate === today

  useEffect(() => {
    window.api.businesses.getAll().then(r => { if (r.ok && r.data) setBusinesses(r.data) })
  }, [])

  useEffect(() => {
    setLoading(true)
    setPage(0)
    setExpandedId(null)
    const { from, to } = nepalDayUTCRange(selectedDate)
    window.api.bills.getAll(undefined, businessFilter ?? undefined, from, to)
      .then(res => { if (res.ok && res.data) setBills(res.data) })
      .finally(() => setLoading(false))
  }, [businessFilter, selectedDate])

  function changeDate(d: string) {
    setSelectedDate(d)
    setPage(0)
  }

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

      setAmendingBill(null); setAmendReason('')
      const { from, to } = nepalDayUTCRange(selectedDate)
      window.api.bills.getAll(undefined, businessFilter ?? undefined, from, to)
        .then(res => { if (res.ok && res.data) setBills(res.data) })

      onAmend({ customer, lines, notes: `Amends ${amendingBill.bill_number}`, paidAmount: amendingBill.paid_amount, amendsBillId: amendingBill.id })
    } catch (err) {
      setAmendError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setAmendSaving(false)
    }
  }

  // ── Filtering & pagination ────────────────────────────────
  const filteredBills = bills.filter(b => showCancelled || b.status !== 'cancelled')
  const totalPages = Math.max(1, Math.ceil(filteredBills.length / PAGE_SIZE))
  const curPage = Math.min(page, totalPages - 1)
  const pagedBills = filteredBills.slice(curPage * PAGE_SIZE, (curPage + 1) * PAGE_SIZE)
  const bsDateLabel = formatDateBSEn(selectedDate + 'T06:15:00Z')

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
                style={{ width: '100%', marginTop: '0.35rem', border: '1.5px solid #d6cfc7', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', background: '#fafaf9' }}
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

      {/* ── Header ── */}
      <div className="catalog-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2>{t('nav.bills')}</h2>
          {filteredBills.length > 0 && (
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>
              {filteredBills.length} {filteredBills.length === 1 ? 'bill' : 'bills'}
            </span>
          )}
        </div>
        <div className="bills-date-nav">
          <button className="bills-date-nav-btn" onClick={() => changeDate(addDay(selectedDate, -1))}>‹</button>
          <div className="bills-date-center">
            <span className="bills-date-label">{bsDateLabel}</span>
            {isToday && <span className="bills-today-badge">{t('bill.today')}</span>}
          </div>
          <button className="bills-date-nav-btn" onClick={() => changeDate(addDay(selectedDate, 1))} disabled={isToday}>›</button>
        </div>
      </div>

      {/* ── Filter bar ── */}
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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
          <button
            className={`biz-filter-tab${showCancelled ? ' biz-filter-tab-active' : ''}`}
            style={{ fontSize: '0.75rem' }}
            onClick={() => { setShowCancelled(v => !v); setPage(0) }}
          >
            {showCancelled ? t('bill.hide_cancelled') : t('bill.show_cancelled')}
          </button>
          {!isToday && (
            <button className="bills-goto-today-btn" onClick={() => changeDate(today)}>
              {t('bill.goto_today')}
            </button>
          )}
        </div>
      </div>

      {/* ── Bills table ── */}
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
          {loading && (
            <tr><td colSpan={9} className="empty-state">{t('common.loading')}</td></tr>
          )}
          {!loading && pagedBills.length === 0 && (
            <tr><td colSpan={9} className="empty-state">{t('bill.no_bills')}</td></tr>
          )}
          {!loading && pagedBills.map(bill => (
            <BillRow
              key={bill.id}
              bill={bill}
              expanded={expandedId === bill.id}
              lines={linesCache[bill.id]}
              payments={paymentsCache[bill.id]}
              onToggle={() => toggleExpand(bill)}
              onPrint={() => openPrint(bill)}
              onAmend={() => { setAmendingBill(bill); setAmendReason(''); setAmendError('') }}
              t={t}
              fmtAmt={fmtAmt}
              fmtDate={fmtDate}
            />
          ))}
        </tbody>
      </table>

      {/* ── Pagination ── */}
      {!loading && totalPages > 1 && (
        <div className="bills-pagination">
          <span className="bills-pagination-info">
            Showing {curPage * PAGE_SIZE + 1}–{Math.min((curPage + 1) * PAGE_SIZE, filteredBills.length)} of {filteredBills.length}
          </span>
          <div className="bills-pagination-controls">
            <button className="bills-pagination-btn" disabled={curPage === 0} onClick={() => setPage(p => p - 1)}>
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                className={`bills-pagination-btn${i === curPage ? ' bills-pagination-btn-active' : ''}`}
                onClick={() => setPage(i)}
              >{i + 1}</button>
            ))}
            <button className="bills-pagination-btn" disabled={curPage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface BillRowProps {
  bill: BillWithCustomer
  expanded: boolean
  lines: BillLineWithDetail[] | undefined
  payments: LedgerEntryView[] | undefined
  onToggle: () => void
  onPrint: () => void
  onAmend: () => void
  t: (key: string) => string
  fmtAmt: (n: number) => string
  fmtDate: (s: string) => string
}

function BillRow({ bill, expanded, lines, payments, onToggle, onPrint, onAmend, t, fmtAmt, fmtDate }: BillRowProps) {
  const isCancelled = bill.status === 'cancelled'
  const typeBadge = isCancelled
    ? <span className="badge badge-cancelled">{t('bill.cancelled_badge')}</span>
    : bill.bill_kind === 'mixed'
      ? <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>{t('bill.type_sale')} + {t('bill.type_processing')}</span>
      : bill.bill_kind === 'processing'
        ? <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>{t('bill.processing_badge')}</span>
        : <span className="badge badge-finished">{t('bill.sale_badge')}</span>

  return (
    <>
      <tr className={isCancelled ? 'bill-row-cancelled' : ''} style={{ cursor: 'pointer' }} onClick={onToggle}>
        <td>
          <span className="bill-number-badge">{bill.bill_number}</span>
          {bill.superseded_by_bill_number && (
            <div className="bill-link-chip">{t('bill.replaced_by').replace('{n}', bill.superseded_by_bill_number)}</div>
          )}
          {bill.amends_bill_number && (
            <div className="bill-link-chip">{t('bill.amends').replace('{n}', bill.amends_bill_number)}</div>
          )}
        </td>
        <td className="text-muted">{fmtDate(bill.created_at)}</td>
        <td className="text-muted" style={{ fontSize: '0.8rem' }}>{bill.business_name}</td>
        <td>
          {typeBadge}
          {isCancelled && bill.cancel_reason && (
            <div className="bill-cancel-reason">{t('bill.cancel_reason_label')} {bill.cancel_reason}</div>
          )}
        </td>
        <td>{bill.customer_name ?? <span className="text-muted">{t('bill.walk_in')}</span>}</td>
        <td style={{ textAlign: 'right' }}>{isCancelled ? <span className="text-muted">—</span> : fmtAmt(bill.grand_total)}</td>
        <td style={{ textAlign: 'right' }}>{isCancelled ? <span className="text-muted">—</span> : fmtAmt(bill.paid_amount)}</td>
        <td style={{ textAlign: 'right' }}>
          {!isCancelled && bill.credit_amount > 0
            ? <span className="outstanding-warn">{fmtAmt(bill.credit_amount)}</span>
            : <span className="text-muted">—</span>}
        </td>
        <td className="row-actions" onClick={e => e.stopPropagation()}>
          <button className="btn-ghost btn-sm" onClick={onPrint} title={t('bill.print')}>🖨</button>
          {bill.status === 'active' && (
            <button className="btn-ghost btn-sm" onClick={onAmend} title={t('bill.amend')} style={{ color: '#ea580c', borderColor: '#fb923c' }}>
              {t('bill.amend')}
            </button>
          )}
          <button className="btn-ghost btn-sm" onClick={onToggle}>{expanded ? '▲' : '▼'}</button>
        </td>
      </tr>

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
                        <span className="payment-timeline-method">{p.method ?? p.kind}</span>
                        <span className="payment-timeline-date">{fmtDate(p.created_at)}</span>
                      </div>
                      <span className="payment-timeline-amount">{fmtAmt(Math.abs(p.amount))}</span>
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

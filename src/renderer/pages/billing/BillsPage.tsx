import { useEffect, useState } from 'react'
import type { AuthUser, BillWithCustomer, BillLineWithDetail } from '../../../shared/types/api'
import PrintReceipt from '../../components/PrintReceipt'

interface Props { currentUser: AuthUser }

const PAYMENT_METHODS = [
  { value: 'cash',    label: 'Cash' },
  { value: 'credit',  label: 'Udharo' },
  { value: 'bank',    label: 'Bank Transfer' },
  { value: 'digital', label: 'Digital Wallet' },
]

export default function BillsPage({ currentUser }: Props) {
  const [bills, setBills] = useState<BillWithCustomer[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [linesCache, setLinesCache] = useState<Record<number, BillLineWithDetail[]>>({})
  const [collectingId, setCollectingId] = useState<number | null>(null)
  const [collectAmount, setCollectAmount] = useState('')
  const [collectMethod, setCollectMethod] = useState('cash')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Print state
  const [printBill, setPrintBill] = useState<BillWithCustomer | null>(null)
  const [printLines, setPrintLines] = useState<BillLineWithDetail[]>([])

  async function load() {
    const res = await window.api.bills.getAll(100)
    if (res.ok && res.data) setBills(res.data)
  }

  useEffect(() => { load() }, [])

  async function toggleExpand(bill: BillWithCustomer) {
    if (expandedId === bill.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(bill.id)
    if (!linesCache[bill.id]) {
      const res = await window.api.bills.getLines(bill.id)
      if (res.ok && res.data) setLinesCache(prev => ({ ...prev, [bill.id]: res.data! }))
    }
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

  function cancelCollect() {
    setCollectingId(null)
    setError('')
  }

  async function submitCollect(bill: BillWithCustomer) {
    const amt = parseFloat(collectAmount)
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    try {
      const res = await window.api.bills.collectPayment(bill.id, amt, collectMethod, currentUser.id)
      if (!res.ok) { setError(res.error ?? 'Error'); return }
      setCollectingId(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IPC error — restart the app')
    } finally {
      setSaving(false)
    }
  }

  function fmt(n: number) {
    return n.toLocaleString('en-NP', { minimumFractionDigits: 2 })
  }

  function fmtDate(s: string) {
    return new Date(s).toLocaleDateString('en-NP', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="catalog-page">
      {printBill && (
        <PrintReceipt
          bill={printBill}
          lines={printLines}
          onClose={() => setPrintBill(null)}
        />
      )}

      <div className="catalog-header">
        <h2>Bills</h2>
        <span className="text-muted" style={{ fontSize: '0.85rem' }}>
          Last {bills.length} bills
        </span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Bill #</th>
            <th>Date</th>
            <th>Customer</th>
            <th style={{ textAlign: 'right' }}>Total</th>
            <th style={{ textAlign: 'right' }}>Paid</th>
            <th style={{ textAlign: 'right' }}>Due</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bills.length === 0 && (
            <tr><td colSpan={7} className="empty-state">No bills yet</td></tr>
          )}
          {bills.map(bill => (
            <BillRow
              key={bill.id}
              bill={bill}
              expanded={expandedId === bill.id}
              lines={linesCache[bill.id]}
              collecting={collectingId === bill.id}
              collectAmount={collectAmount}
              collectMethod={collectMethod}
              saving={saving}
              error={error}
              onToggle={() => toggleExpand(bill)}
              onOpenCollect={() => openCollect(bill)}
              onCancelCollect={cancelCollect}
              onAmountChange={setCollectAmount}
              onMethodChange={setCollectMethod}
              onSubmitCollect={() => submitCollect(bill)}
              onPrint={() => openPrint(bill)}
              fmt={fmt}
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
  collecting: boolean
  collectAmount: string
  collectMethod: string
  saving: boolean
  error: string
  onToggle: () => void
  onOpenCollect: () => void
  onCancelCollect: () => void
  onAmountChange: (v: string) => void
  onMethodChange: (v: string) => void
  onSubmitCollect: () => void
  onPrint: () => void
  fmt: (n: number) => string
  fmtDate: (s: string) => string
}

function BillRow({
  bill, expanded, lines, collecting,
  collectAmount, collectMethod, saving, error,
  onToggle, onOpenCollect, onCancelCollect,
  onAmountChange, onMethodChange, onSubmitCollect, onPrint,
  fmt, fmtDate,
}: BillRowProps) {
  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={onToggle}>
        <td><span className="bill-number-badge">{bill.bill_number}</span></td>
        <td className="text-muted">{fmtDate(bill.created_at)}</td>
        <td>{bill.customer_name ?? <span className="text-muted">Walk-in</span>}</td>
        <td style={{ textAlign: 'right' }}>Rs. {fmt(bill.grand_total)}</td>
        <td style={{ textAlign: 'right' }}>Rs. {fmt(bill.paid_amount)}</td>
        <td style={{ textAlign: 'right' }}>
          {bill.due_amount > 0
            ? <span className="outstanding-warn">Rs. {fmt(bill.due_amount)}</span>
            : <span className="text-muted">—</span>}
        </td>
        <td className="row-actions" onClick={e => e.stopPropagation()}>
          {bill.due_amount > 0 && (
            <button className="btn-primary btn-sm" onClick={onOpenCollect}>Collect</button>
          )}
          <button className="btn-ghost btn-sm" onClick={onPrint} title="Print receipt">🖨</button>
          <button className="btn-ghost btn-sm">{expanded ? '▲' : '▼'}</button>
        </td>
      </tr>

      {collecting && (
        <tr>
          <td colSpan={7} style={{ padding: 0 }}>
            <div className="collect-form">
              <span style={{ fontWeight: 600 }}>Collect payment — {bill.bill_number}</span>
              <label>
                Amount (Rs.)
                <input
                  type="number" step="0.01" min="0.01"
                  value={collectAmount}
                  onChange={e => onAmountChange(e.target.value)}
                  autoFocus
                />
              </label>
              <label>
                Method
                <select value={collectMethod} onChange={e => onMethodChange(e.target.value)}>
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
              {error && <span className="form-error">{error}</span>}
              <div className="form-actions">
                <button className="btn-primary btn-sm" onClick={onSubmitCollect} disabled={saving}>
                  {saving ? 'Saving…' : 'Collect'}
                </button>
                <button className="btn-ghost btn-sm" onClick={onCancelCollect}>Cancel</button>
              </div>
            </div>
          </td>
        </tr>
      )}

      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: 0 }}>
            <div style={{ padding: '0.5rem 1.5rem 0.75rem', background: 'var(--bg-subtle)' }}>
              <table className="data-table" style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'right' }}>Discount</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {!lines && (
                    <tr><td colSpan={5} className="empty-state">Loading…</td></tr>
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
                      <td style={{ textAlign: 'right' }}>Rs. {l.rate_snapshot.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        {l.line_discount > 0 ? `Rs. ${l.line_discount}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs. {fmt(l.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bill.discount_amount > 0 && (
                <div style={{ textAlign: 'right', padding: '0.25rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Bill discount: Rs. {fmt(bill.discount_amount)}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

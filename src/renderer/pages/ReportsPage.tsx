import { useEffect, useState } from 'react'
import type { SalesReport, ItemSalesLine, CustomerLedgerLine } from '../../shared/types/api'

type ReportType = 'sales' | 'items' | 'customers'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function isoMonthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('sales')
  const [fromDate, setFromDate] = useState(isoMonthStart())
  const [toDate, setToDate] = useState(isoToday())

  const [salesReport, setSalesReport] = useState<SalesReport | null>(null)
  const [itemReport, setItemReport] = useState<ItemSalesLine[] | null>(null)
  const [customerLedger, setCustomerLedger] = useState<CustomerLedgerLine[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try {
      if (reportType === 'sales') {
        const res = await window.api.dashboard.getSalesReport(fromDate, toDate)
        if (res.ok && res.data) setSalesReport(res.data)
      } else if (reportType === 'items') {
        const res = await window.api.dashboard.getItemSalesReport(fromDate, toDate)
        if (res.ok && res.data) setItemReport(res.data)
      } else {
        const res = await window.api.dashboard.getCustomerLedger()
        if (res.ok && res.data) setCustomerLedger(res.data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { run() }, [reportType, fromDate, toDate])

  function fmt(n: number) {
    return n.toLocaleString('en-NP', { minimumFractionDigits: 2 })
  }

  function fmtDate(s: string) {
    return new Date(s).toLocaleDateString('en-NP', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const PRESETS = [
    { label: 'Today', from: isoToday(), to: isoToday() },
    {
      label: 'This week',
      from: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10) })(),
      to: isoToday(),
    },
    { label: 'This month', from: isoMonthStart(), to: isoToday() },
    {
      label: 'Last month',
      from: (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10) })(),
      to: (() => { const d = new Date(); d.setDate(0); return d.toISOString().slice(0, 10) })(),
    },
  ]

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <h2>Reports</h2>
      </div>

      {/* Report type tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['sales', 'items', 'customers'] as ReportType[]).map(t => (
          <button
            key={t}
            className={`btn-ghost${reportType === t ? ' nav-btn-active' : ''}`}
            onClick={() => setReportType(t)}
          >
            {t === 'sales' ? 'Sales' : t === 'items' ? 'Items Sold' : 'Customer Ledger'}
          </button>
        ))}
      </div>

      {/* Date range (hidden for customer ledger) */}
      {reportType !== 'customers' && (
        <div className="report-filters">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                className="btn-ghost btn-sm"
                onClick={() => { setFromDate(p.from); setToDate(p.to) }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.875rem', color: '#9ca3af' }}>
              From <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </label>
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.875rem', color: '#9ca3af' }}>
              To <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </label>
          </div>
        </div>
      )}

      {loading && <p className="text-muted" style={{ marginTop: '1rem' }}>Loading…</p>}

      {/* ── Sales report ──────────────────────────────────────── */}
      {reportType === 'sales' && salesReport && !loading && (
        <>
          <div className="stat-grid" style={{ marginBottom: '1rem' }}>
            <SummaryChip label="Bills" value={String(salesReport.bill_count)} />
            <SummaryChip label="Total Billed" value={`Rs. ${fmt(salesReport.total_billed)}`} />
            <SummaryChip label="Collected" value={`Rs. ${fmt(salesReport.total_collected)}`} />
            <SummaryChip label="Outstanding" value={`Rs. ${fmt(salesReport.total_outstanding)}`} red={salesReport.total_outstanding > 0} />
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
              </tr>
            </thead>
            <tbody>
              {salesReport.lines.length === 0 && (
                <tr><td colSpan={6} className="empty-state">No bills in this period</td></tr>
              )}
              {salesReport.lines.map(l => (
                <tr key={l.bill_number}>
                  <td><span className="bill-number-badge">{l.bill_number}</span></td>
                  <td className="text-muted">{fmtDate(l.created_at)}</td>
                  <td>{l.customer_name ?? <span className="text-muted">Walk-in</span>}</td>
                  <td style={{ textAlign: 'right' }}>Rs. {fmt(l.grand_total)}</td>
                  <td style={{ textAlign: 'right' }}>Rs. {fmt(l.paid_amount)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {l.due_amount > 0
                      ? <span className="outstanding-warn">Rs. {fmt(l.due_amount)}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Items sold report ─────────────────────────────────── */}
      {reportType === 'items' && itemReport && !loading && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ textAlign: 'right' }}>Total Qty</th>
              <th style={{ textAlign: 'right' }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {itemReport.length === 0 && (
              <tr><td colSpan={3} className="empty-state">No sales in this period</td></tr>
            )}
            {itemReport.map((l, i) => (
              <tr key={i}>
                <td>
                  {l.item_name}
                  {l.variant_name && l.variant_name !== l.item_name && (
                    <span className="text-muted"> · {l.variant_name}</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>{l.total_qty} {l.unit_abbreviation}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs. {fmt(l.total_revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Customer ledger ───────────────────────────────────── */}
      {reportType === 'customers' && customerLedger && !loading && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th style={{ textAlign: 'right' }}>Total Billed</th>
              <th style={{ textAlign: 'right' }}>Total Paid</th>
              <th style={{ textAlign: 'right' }}>Outstanding</th>
              <th>Last Bill</th>
            </tr>
          </thead>
          <tbody>
            {customerLedger.length === 0 && (
              <tr><td colSpan={6} className="empty-state">No customers</td></tr>
            )}
            {customerLedger.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td className="text-muted">{c.phone ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>Rs. {fmt(c.total_billed)}</td>
                <td style={{ textAlign: 'right' }}>Rs. {fmt(c.total_paid)}</td>
                <td style={{ textAlign: 'right' }}>
                  {c.outstanding > 0
                    ? <span className="outstanding-warn">Rs. {fmt(c.outstanding)}</span>
                    : <span className="text-muted">—</span>}
                </td>
                <td className="text-muted">
                  {c.last_bill_date ? fmtDate(c.last_bill_date) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function SummaryChip({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="stat-card" style={{ padding: '0.6rem 1rem' }}>
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ fontSize: '1.1rem', color: red ? '#fca5a5' : '#f9fafb' }}>
        {value}
      </span>
    </div>
  )
}

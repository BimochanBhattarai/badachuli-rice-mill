import { useEffect, useState } from 'react'
import type { SalesReport, ItemSalesLine, CustomerLedgerLine, BusinessRow } from '../../shared/types/api'
import { useLanguage } from '../i18n'

type ReportType = 'sales' | 'items' | 'customers'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function isoMonthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function ReportsPage() {
  const { t, fmtDate, fmtAmt } = useLanguage()
  const [reportType, setReportType] = useState<ReportType>('sales')
  const [fromDate, setFromDate] = useState(isoMonthStart())
  const [toDate, setToDate] = useState(isoToday())
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [businessFilter, setBusinessFilter] = useState<number | null>(null)

  const [salesReport, setSalesReport] = useState<SalesReport | null>(null)
  const [itemReport, setItemReport] = useState<ItemSalesLine[] | null>(null)
  const [customerLedger, setCustomerLedger] = useState<CustomerLedgerLine[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    const bizId = businessFilter ?? undefined
    try {
      if (reportType === 'sales') {
        const res = await window.api.dashboard.getSalesReport(fromDate, toDate, bizId)
        if (res.ok && res.data) setSalesReport(res.data)
      } else if (reportType === 'items') {
        const res = await window.api.dashboard.getItemSalesReport(fromDate, toDate, bizId)
        if (res.ok && res.data) setItemReport(res.data)
      } else {
        const res = await window.api.dashboard.getCustomerLedger()
        if (res.ok && res.data) setCustomerLedger(res.data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    window.api.businesses.getAll().then(r => { if (r.ok && r.data) setBusinesses(r.data) })
  }, [])

  useEffect(() => { run() }, [reportType, fromDate, toDate, businessFilter])

  const PRESETS = [
    { label: t('reports.today'), from: isoToday(), to: isoToday() },
    {
      label: t('reports.this_week'),
      from: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10) })(),
      to: isoToday(),
    },
    { label: t('reports.this_month'), from: isoMonthStart(), to: isoToday() },
    {
      label: t('reports.last_month'),
      from: (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10) })(),
      to: (() => { const d = new Date(); d.setDate(0); return d.toISOString().slice(0, 10) })(),
    },
  ]

  const REPORT_TABS: { key: ReportType; label: string }[] = [
    { key: 'sales', label: t('reports.sales') },
    { key: 'items', label: t('reports.items_sold') },
    { key: 'customers', label: t('reports.customer_ledger') },
  ]

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <h2>{t('reports.title')}</h2>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {REPORT_TABS.map(tab => (
          <button
            key={tab.key}
            className={`btn-ghost${reportType === tab.key ? ' nav-btn-active' : ''}`}
            onClick={() => setReportType(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {reportType !== 'customers' && businesses.length > 0 && (
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
              {t('reports.from')} <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </label>
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.875rem', color: '#9ca3af' }}>
              {t('reports.to')} <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </label>
          </div>
        </div>
      )}

      {loading && <p className="text-muted" style={{ marginTop: '1rem' }}>{t('common.loading')}</p>}

      {reportType === 'sales' && salesReport && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
            <SummaryChip label={t('reports.bills_count')} value={String(salesReport.bill_count)} />
            <SummaryChip label={t('reports.total_billed')} value={fmtAmt(salesReport.total_billed)} />
            <SummaryChip label={t('reports.collected_label')} value={fmtAmt(salesReport.total_collected)} green />
            <SummaryChip label={t('reports.outstanding_label')} value={fmtAmt(salesReport.total_outstanding)} red={salesReport.total_outstanding > 0} />
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('reports.bill_num')}</th>
                <th>{t('common.date')}</th>
                <th>{t('bill.customer')}</th>
                <th style={{ textAlign: 'right' }}>{t('bill.total')}</th>
                <th style={{ textAlign: 'right' }}>{t('bill.paid')}</th>
                <th style={{ textAlign: 'right' }}>{t('bill.due')}</th>
              </tr>
            </thead>
            <tbody>
              {salesReport.lines.length === 0 && (
                <tr><td colSpan={6} className="empty-state">{t('reports.no_bills')}</td></tr>
              )}
              {salesReport.lines.map(l => (
                <tr key={l.bill_number}>
                  <td><span className="bill-number-badge">{l.bill_number}</span></td>
                  <td className="text-muted">{fmtDate(l.created_at)}</td>
                  <td>{l.customer_name ?? <span className="text-muted">{t('reports.walk_in')}</span>}</td>
                  <td style={{ textAlign: 'right' }}>{fmtAmt(l.grand_total)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtAmt(l.paid_amount)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {l.due_amount > 0
                      ? <span className="outstanding-warn">{fmtAmt(l.due_amount)}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {reportType === 'items' && itemReport && !loading && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('stock.item')}</th>
              <th style={{ textAlign: 'right' }}>{t('reports.total_qty')}</th>
              <th style={{ textAlign: 'right' }}>{t('reports.revenue')}</th>
            </tr>
          </thead>
          <tbody>
            {itemReport.length === 0 && (
              <tr><td colSpan={3} className="empty-state">{t('reports.no_sales')}</td></tr>
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
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtAmt(l.total_revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reportType === 'customers' && customerLedger && !loading && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('common.phone')}</th>
              <th style={{ textAlign: 'right' }}>{t('customer.total_billed')}</th>
              <th style={{ textAlign: 'right' }}>{t('customer.total_paid')}</th>
              <th style={{ textAlign: 'right' }}>{t('reports.outstanding_label')}</th>
              <th>{t('customer.last_bill')}</th>
            </tr>
          </thead>
          <tbody>
            {customerLedger.length === 0 && (
              <tr><td colSpan={6} className="empty-state">{t('reports.no_customers')}</td></tr>
            )}
            {customerLedger.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td className="text-muted">{c.phone ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{fmtAmt(c.total_billed)}</td>
                <td style={{ textAlign: 'right' }}>{fmtAmt(c.total_paid)}</td>
                <td style={{ textAlign: 'right' }}>
                  {c.outstanding > 0
                    ? <span className="outstanding-warn">{fmtAmt(c.outstanding)}</span>
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

function SummaryChip({ label, value, red, green }: { label: string; value: string; red?: boolean; green?: boolean }) {
  return (
    <div style={{
      background: '#fff',
      border: '1.5px solid #e7e0d8',
      borderRadius: 12,
      padding: '0.9rem 1.15rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.35rem',
    }}>
      <span style={{
        fontSize: '0.65rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#a8a29e',
      }}>{label}</span>
      <span style={{
        fontSize: '1.15rem',
        fontWeight: 800,
        letterSpacing: '-0.01em',
        color: red ? '#dc2626' : green ? '#15803d' : '#1c1917',
      }}>{value}</span>
    </div>
  )
}

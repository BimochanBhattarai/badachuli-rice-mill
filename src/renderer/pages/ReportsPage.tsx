import { useEffect, useState, useMemo } from 'react'
import type { ItemReportRow, CustomerLedgerLine, BusinessRow, BusinessSummary } from '../../shared/types/api'
import { useLanguage, bsMonthStartISO } from '../i18n'
import { BalanceAmount } from '../components/BalanceAmount'

type ReportTab = 'summary' | 'sale' | 'processing' | 'customers'
type DatePreset = 'today' | 'month' | 'custom'

function isoToday() { return new Date().toISOString().slice(0, 10) }

interface ItemGroup {
  item_id: number
  item_name: string
  unit_abbreviation: string
  variants: ItemReportRow[]
  total_qty: number
  total_amount: number
}

function groupByItem(rows: ItemReportRow[]): ItemGroup[] {
  const map = new Map<number, ItemGroup>()
  for (const r of rows) {
    if (!map.has(r.item_id)) {
      map.set(r.item_id, {
        item_id: r.item_id,
        item_name: r.item_name,
        unit_abbreviation: r.unit_abbreviation,
        variants: [],
        total_qty: 0,
        total_amount: 0,
      })
    }
    const g = map.get(r.item_id)!
    g.variants.push(r)
    g.total_qty += r.total_qty
    g.total_amount += r.total_amount
  }
  return Array.from(map.values())
}

function fmtQty(n: number) { return n % 1 === 0 ? String(n) : n.toFixed(2) }

export default function ReportsPage() {
  const { t, fmtDate, fmtAmt } = useLanguage()
  const [tab, setTab] = useState<ReportTab>('summary')
  const [preset, setPreset] = useState<DatePreset>('month')
  const [fromDate, setFromDate] = useState(() => bsMonthStartISO())
  const [toDate, setToDate] = useState(isoToday())
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [bizFilter, setBizFilter] = useState<number | null>(null)
  const [rows, setRows] = useState<ItemReportRow[] | null>(null)
  const [customerLedger, setCustomerLedger] = useState<CustomerLedgerLine[] | null>(null)
  const [summary, setSummary] = useState<BusinessSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [itemQuery, setItemQuery] = useState('')
  const [showItemDrop, setShowItemDrop] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  useEffect(() => {
    window.api.businesses.getAll().then(r => { if (r.ok && r.data) setBusinesses(r.data) })
  }, [])

  async function run() {
    setLoading(true)
    setRows(null)
    setCustomerLedger(null)
    setSummary(null)
    setError('')
    try {
      const biz = bizFilter ?? undefined
      if (tab === 'summary') {
        const res = await window.api.dashboard.getBusinessSummary(fromDate, toDate, biz)
        if (res.ok) setSummary(res.data ?? null)
        else { setError(res.error ?? t('reports.error')) }
      } else if (tab === 'sale' || tab === 'processing') {
        const res = await window.api.dashboard.getItemReport(tab, fromDate, toDate, biz)
        if (res.ok) setRows(res.data ?? [])
        else { setError(res.error ?? t('reports.error')); setRows([]) }
      } else {
        const res = await window.api.dashboard.getCustomerBalances()
        if (res.ok) setCustomerLedger(res.data ?? [])
        else { setError(res.error ?? t('reports.error')); setCustomerLedger([]) }
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { run() }, [tab, fromDate, toDate, bizFilter])

  function applyPreset(p: DatePreset) {
    setPreset(p)
    if (p === 'today') { setFromDate(isoToday()); setToDate(isoToday()) }
    else if (p === 'month') { setFromDate(bsMonthStartISO()); setToDate(isoToday()) }
  }

  const allGroups = useMemo(() => rows ? groupByItem(rows) : [], [rows])
  const dropSuggestions = useMemo(() => {
    if (!itemQuery.trim()) return allGroups
    const q = itemQuery.toLowerCase()
    return allGroups.filter(g => g.item_name.toLowerCase().includes(q))
  }, [allGroups, itemQuery])
  const groups = useMemo(() => {
    if (selectedItemId !== null) return allGroups.filter(g => g.item_id === selectedItemId)
    if (itemQuery.trim()) return dropSuggestions
    return allGroups
  }, [allGroups, dropSuggestions, selectedItemId, itemQuery])
  const grandTotal = useMemo(() => groups.reduce((s, g) => s + g.total_amount, 0), [groups])

  function toggleCollapse(itemId: number) {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  function selectItem(g: ItemGroup) {
    setSelectedItemId(g.item_id)
    setItemQuery(g.item_name)
    setShowItemDrop(false)
  }

  function clearItemSearch() {
    setSelectedItemId(null)
    setItemQuery('')
    setShowItemDrop(false)
  }

  const TABS: { key: ReportTab; label: string }[] = [
    { key: 'summary',    label: t('reports.summary') },
    { key: 'sale',       label: t('reports.sale_report') },
    { key: 'processing', label: t('reports.processing_report') },
    { key: 'customers',  label: t('reports.customer_balance') },
  ]

  const PRESETS: { key: DatePreset; label: string }[] = [
    { key: 'today', label: t('reports.today') },
    { key: 'month', label: t('reports.this_month') },
    { key: 'custom', label: t('reports.custom') },
  ]

  const showDateFilter = tab !== 'customers'

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <h2>{t('reports.title')}</h2>
      </div>

      {/* ── Report type tabs ── */}
      <div style={{
        display: 'inline-flex', background: '#f0ebe4', borderRadius: 14,
        padding: '0.22rem', gap: '0.15rem', marginBottom: '1.5rem',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.07)',
      }}>
        {TABS.map(tab_ => (
          <button
            key={tab_.key}
            onClick={() => setTab(tab_.key)}
            style={{
              padding: '0.55rem 1.3rem', borderRadius: 11, border: 'none',
              cursor: 'pointer', fontWeight: tab === tab_.key ? 700 : 500,
              fontSize: '0.88rem',
              background: tab === tab_.key ? '#f97316' : 'transparent',
              color: tab === tab_.key ? '#fff' : '#78716c',
              boxShadow: tab === tab_.key ? '0 1px 6px rgba(249,115,22,0.4)' : 'none',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { if (tab !== tab_.key) (e.currentTarget as HTMLButtonElement).style.color = '#1c1917' }}
            onMouseLeave={e => { if (tab !== tab_.key) (e.currentTarget as HTMLButtonElement).style.color = '#78716c' }}
          >{tab_.label}</button>
        ))}
      </div>

      {/* ── Business filter pills ── */}
      {businesses.length > 1 && tab !== 'customers' && (
        <div className="biz-filter-tabs" style={{ marginBottom: '1rem' }}>
          <button
            className={`biz-filter-tab${bizFilter === null ? ' biz-filter-tab-active' : ''}`}
            onClick={() => setBizFilter(null)}
          >{t('common.all')}</button>
          {businesses.map(b => (
            <button key={b.id}
              className={`biz-filter-tab${bizFilter === b.id ? ' biz-filter-tab-active' : ''}`}
              onClick={() => setBizFilter(b.id)}
            >{b.name}</button>
          ))}
        </div>
      )}

      {/* ── Date filter card ── */}
      {showDateFilter && (
        <div style={{
          display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap',
          background: '#fff', borderRadius: 14, padding: '0.9rem 1.1rem',
          border: '1.5px solid #e7e0d8', marginBottom: '1.25rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                style={{
                  padding: '0.38rem 0.85rem', borderRadius: 20,
                  border: `1.5px solid ${preset === p.key ? '#f97316' : '#e7e0d8'}`,
                  background: preset === p.key ? '#f97316' : '#faf8f5',
                  color: preset === p.key ? '#fff' : '#57534e',
                  fontWeight: preset === p.key ? 700 : 500,
                  fontSize: '0.82rem', cursor: 'pointer',
                  boxShadow: preset === p.key ? '0 1px 5px rgba(249,115,22,0.35)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  const btn = e.currentTarget as HTMLButtonElement
                  if (preset !== p.key) { btn.style.borderColor = '#f97316'; btn.style.color = '#ea580c'; btn.style.transform = 'translateY(-1px)' }
                  else { btn.style.background = '#ea580c'; btn.style.transform = 'translateY(-1px)' }
                }}
                onMouseLeave={e => {
                  const btn = e.currentTarget as HTMLButtonElement
                  if (preset !== p.key) { btn.style.borderColor = '#e7e0d8'; btn.style.color = '#57534e' }
                  else { btn.style.background = '#f97316' }
                  btn.style.transform = 'translateY(0)'
                }}
              >{p.label}</button>
            ))}
          </div>

          <div style={{ width: 1, height: 38, background: '#e7e0d8', flexShrink: 0 }} />

          {(['from', 'to'] as const).map(side => {
            const val = side === 'from' ? fromDate : toDate
            return (
              <div key={side} style={{
                display: 'flex', flexDirection: 'column', gap: '0.08rem',
                background: '#faf8f5', borderRadius: 10, padding: '0.45rem 0.85rem',
                border: `1.5px solid ${preset === 'custom' ? '#f97316' : '#e7e0d8'}`,
                minWidth: 148, transition: 'border-color 0.15s',
              }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e' }}>
                  {side === 'from' ? t('reports.from') : t('reports.to')}
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#292524' }}>
                  {fmtDate(val)}
                </span>
                <input
                  type="date" value={val}
                  onChange={e => {
                    if (side === 'from') { setFromDate(e.target.value); setPreset('custom') }
                    else { setToDate(e.target.value); setPreset('custom') }
                  }}
                  style={{ fontSize: '0.68rem', color: '#b2a99e', border: 'none', padding: 0, background: 'transparent', cursor: 'pointer', width: '100%' }}
                />
              </div>
            )
          })}
        </div>
      )}

      {loading && <p className="text-muted">{t('common.loading')}</p>}
      {error   && <p className="form-error">{error}</p>}

      {/* ── Business Summary tab ── */}
      {tab === 'summary' && !loading && summary && (
        <SummaryView summary={summary} bizFilter={bizFilter} fmtAmt={fmtAmt} t={t} />
      )}
      {tab === 'summary' && !loading && !summary && !error && (
        <div className="empty-state">{t('common.no_data')}</div>
      )}

      {/* ── Sale / Processing item report ── */}
      {(tab === 'sale' || tab === 'processing') && !loading && rows !== null && (
        <>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: 300 }}>
              <input
                type="text" className="search-input"
                placeholder={t('reports.item_col') + ' ' + t('common.search')}
                value={itemQuery}
                onChange={e => { setItemQuery(e.target.value); setSelectedItemId(null); setShowItemDrop(true) }}
                onFocus={() => setShowItemDrop(true)}
                onBlur={() => setTimeout(() => setShowItemDrop(false), 150)}
                style={{ width: '100%', paddingRight: itemQuery ? '2rem' : undefined }}
              />
              {itemQuery && (
                <button
                  onClick={clearItemSearch}
                  style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#78716c', fontSize: '1rem', lineHeight: 1, padding: 0 }}
                >×</button>
              )}
              {showItemDrop && dropSuggestions.length > 0 && (
                <ul className="dropdown-list">
                  {dropSuggestions.map(g => (
                    <li key={g.item_id} onMouseDown={() => selectItem(g)}>
                      <span>{g.item_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {groups.length > 0 && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <SummaryChip label={t('reports.item_col')} value={String(groups.length)} />
                <SummaryChip label={tab === 'sale' ? t('reports.revenue') : t('reports.total_qty')} value={fmtAmt(grandTotal)} green />
              </div>
            )}
          </div>

          {groups.length === 0 ? (
            <div className="empty-state">{tab === 'sale' ? t('reports.no_sales') : t('reports.no_processing')}</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('reports.item_col')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.qty_col')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.amount_col')}</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => {
                  const multiVariant = g.variants.length > 1 ||
                    (g.variants.length === 1 && g.variants[0].variant_name && g.variants[0].variant_name !== g.item_name)
                  const isCollapsed = !expandedItems.has(g.item_id)
                  return [
                    <tr key={`item-${g.item_id}`} className={multiVariant ? 'report-item-row report-item-row--multi' : 'report-item-row'}>
                      <td style={{ fontWeight: 700, color: '#1c1917' }}>
                        {multiVariant ? (
                          <button
                            onClick={() => toggleCollapse(g.item_id)}
                            className="report-expand-btn"
                          >
                            {isCollapsed ? '+' : '−'}
                          </button>
                        ) : (
                          <span className="report-expand-placeholder" />
                        )}
                        {g.item_name}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtQty(g.total_qty)} {g.unit_abbreviation}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#ea580c' }}>{fmtAmt(g.total_amount)}</td>
                    </tr>,
                    ...(multiVariant && !isCollapsed ? g.variants.map(v => (
                      <tr key={`v-${g.item_id}-${v.variant_id ?? 'null'}`} className="report-variant-row">
                        <td>
                          <span className="report-expand-placeholder" />
                          <span style={{ color: '#a8a29e', marginRight: '0.4rem', fontSize: '0.8rem' }}>└</span>
                          <span>{v.variant_name ?? g.item_name}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{fmtQty(v.total_qty)} {v.unit_abbreviation}</td>
                        <td style={{ textAlign: 'right' }}>{fmtAmt(v.total_amount)}</td>
                      </tr>
                    )) : []),
                  ]
                })}
                <tr className="report-grand-total-row">
                  <td>{t('reports.grand_total')}</td>
                  <td />
                  <td style={{ textAlign: 'right' }}>{fmtAmt(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </>
      )}

      {/* ── Customer balance ── */}
      {tab === 'customers' && !loading && customerLedger !== null && (
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
                <td style={{ textAlign: 'right', color: '#15803d' }}>{fmtAmt(c.total_paid)}</td>
                <td style={{ textAlign: 'right' }}>
                  <BalanceAmount value={c.outstanding} />
                </td>
                <td className="text-muted">{c.last_bill_date ? fmtDate(c.last_bill_date) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Summary view sub-component ────────────────────────────────────────────

function SummaryView({
  summary, bizFilter, fmtAmt, t,
}: {
  summary: BusinessSummary
  bizFilter: number | null
  fmtAmt: (n: number) => string
  t: (k: string) => string
}) {
  const { sales, processing, expenses } = summary
  const revenueTotal = sales.total + processing.total
  const expensesTotal = expenses?.total ?? 0
  const net = revenueTotal - expensesTotal

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ── Net headline ── */}
      <div style={{
        background: '#fff', border: '1.5px solid #e7e0d8', borderRadius: 14,
        padding: '1.1rem 1.4rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', marginBottom: '0.25rem' }}>
            {t('reports.revenue_in')}
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d' }}>{fmtAmt(revenueTotal)}</div>
        </div>
        {expenses && (
          <>
            <div style={{ fontSize: '1.6rem', color: '#d6cec4', fontWeight: 300 }}>−</div>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', marginBottom: '0.25rem' }}>
                {t('reports.money_out')}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626' }}>{fmtAmt(expensesTotal)}</div>
            </div>
            <div style={{ fontSize: '1.6rem', color: '#d6cec4', fontWeight: 300 }}>=</div>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', marginBottom: '0.25rem' }}>
                {t('reports.net_total')}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: net >= 0 ? '#15803d' : '#dc2626' }}>{fmtAmt(net)}</div>
            </div>
          </>
        )}
      </div>

      {/* ── Sales + Processing cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
        <SectionCard
          label={t('reports.total_sales')}
          accentColor="#f97316"
          rows={[
            { label: t('reports.revenue'), value: fmtAmt(sales.total), bold: true },
            { label: t('reports.bills_count_label'), value: String(sales.count) },
          ]}
        />
        <SectionCard
          label={t('reports.total_processing')}
          accentColor="#a16207"
          rows={[
            { label: t('reports.revenue'), value: fmtAmt(processing.total), bold: true },
            { label: t('reports.bills_count_label'), value: String(processing.count) },
          ]}
        />

        {/* Cash & Credit — these cannot be split per line type (a payment has no
            line type), so they live in their own card. Receivable/advance are
            point-in-time and all-businesses by design: there is one balance per
            customer, not one per business. */}
        <SectionCard
          label={t('reports.cash_and_credit')}
          accentColor="#0891b2"
          rows={[
            {
              // Under a business filter this is counter cash only: a payment against a
              // single global balance cannot be attributed to one business.
              label: bizFilter ? t('reports.counter_cash') : t('reports.cash_collected'),
              value: fmtAmt(summary.cash_collected), green: true,
            },
            { label: t('reports.credit_extended'), value: fmtAmt(summary.credit_extended) },
            { label: t('reports.receivable_now'), value: fmtAmt(summary.receivable_now), bold: true, red: summary.receivable_now > 0 },
            { label: t('reports.advance_held_now'), value: fmtAmt(summary.advance_held_now) },
          ]}
        />

        {/* Expenses card — combined view only */}
        {expenses ? (
          <SectionCard
            label={t('reports.total_expenses')}
            accentColor="#dc2626"
            rows={[
              { label: t('reports.general_expenses'), value: fmtAmt(expenses.general) },
              { label: t('reports.salary_paid'), value: fmtAmt(expenses.salary) },
              { label: t('reports.money_out'), value: fmtAmt(expenses.total), bold: true, red: true },
            ]}
          />
        ) : (
          <div style={{
            background: '#faf8f5', border: '1.5px dashed #e7e0d8', borderRadius: 12,
            padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <p style={{ fontSize: '0.82rem', color: '#a8a29e', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
              {t('reports.expenses_business_wide')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionCard({
  label, accentColor, rows,
}: {
  label: string
  accentColor: string
  rows: { label: string; value: string; bold?: boolean; green?: boolean; red?: boolean }[]
}) {
  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e7e0d8', borderRadius: 12,
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        background: accentColor, padding: '0.6rem 1rem',
        fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: '#fff',
      }}>
        {label}
      </div>
      <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.875rem' }}>
            <span style={{ color: '#78716c' }}>{r.label}</span>
            <span style={{
              fontWeight: r.bold ? 800 : 600,
              color: r.green ? '#15803d' : r.red ? '#dc2626' : '#1c1917',
            }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SummaryChip({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e7e0d8', borderRadius: 12,
      padding: '0.65rem 1.1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 90,
    }}>
      <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e' }}>
        {label}
      </span>
      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: green ? '#15803d' : '#1c1917' }}>
        {value}
      </span>
    </div>
  )
}

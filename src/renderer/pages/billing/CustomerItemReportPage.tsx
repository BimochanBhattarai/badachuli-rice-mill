import { useEffect, useMemo, useState } from 'react'
import type {
  CustomerWithBalance,
  CustomerStatementEntry,
  CustomerItemLine,
} from '../../../shared/types/api'
import { useLanguage, bsMonthStartISO } from '../../i18n'
import { ArrowLeft, Search, ListTree } from 'lucide-react'

interface Props {
  customer: CustomerWithBalance
  onBack: () => void
}

type DatePreset = 'all' | 'today' | 'month' | 'custom'
type ViewMode = 'all' | 'items' | 'cash'

function isoToday() { return new Date().toISOString().slice(0, 10) }
function fmtQty(n: number) { return n % 1 === 0 ? String(n) : n.toFixed(2) }

/** The date part of a DB `created_at` ('YYYY-MM-DD HH:MM:SS', UTC). */
function dayOf(ts: string) { return ts.slice(0, 10) }

// ── Line-type badge ────────────────────────────────────────────────────────
// Derived from bill_lines.line_type plus items.category, so grain brought in for
// milling reads differently from goods sold over the counter.
interface BadgeSpec { labelKey: string; bg: string; fg: string }

function badgeFor(lineType: string, category: string): BadgeSpec {
  if (lineType === 'processing') return { labelKey: 'citem.type_processing', bg: '#fef3c7', fg: '#92400e' }
  if (category === 'byproduct')  return { labelKey: 'citem.type_byproduct',  bg: '#ccfbf1', fg: '#0f766e' }
  if (category === 'raw_material') return { labelKey: 'citem.type_raw',      bg: '#dbeafe', fg: '#1d4ed8' }
  return { labelKey: 'citem.type_goods', bg: '#ffedd5', fg: '#c2410c' }
}

/** Badge for a non-sale ledger row. A cancel reversal is a credit but not cash. */
function cashBadgeFor(kind: string): BadgeSpec {
  switch (kind) {
    case 'payment':
    case 'loan_repayment':  return { labelKey: 'citem.type_cash_in',   bg: '#dcfce7', fg: '#15803d' }
    case 'cancel_reversal': return { labelKey: 'citem.type_reversal',  bg: '#f5f0eb', fg: '#57534e' }
    case 'opening':         return { labelKey: 'citem.type_opening',   bg: '#dbeafe', fg: '#1d4ed8' }
    case 'loan':            return { labelKey: 'citem.type_loan',      bg: '#fef3c7', fg: '#92400e' }
    default:                return { labelKey: 'citem.type_adjust',    bg: '#fee2e2', fg: '#b91c1c' }
  }
}

// ── Per-item grouping ──────────────────────────────────────────────────────
interface VariantGroup {
  key: string
  variant_name: string | null
  unit: string
  qty: number
  amount: number
  bills: Set<number>
}

interface ItemGroup {
  item_id: number
  item_name: string
  category: string
  line_type: string
  mixedType: boolean
  units: Set<string>
  qty: number
  amount: number
  bills: Set<number>
  variants: VariantGroup[]
}

function groupByItem(lines: CustomerItemLine[]): ItemGroup[] {
  const map = new Map<number, ItemGroup>()
  for (const l of lines) {
    let g = map.get(l.item_id)
    if (!g) {
      g = {
        item_id: l.item_id,
        item_name: l.item_name,
        category: l.item_category,
        line_type: l.line_type,
        mixedType: false,
        units: new Set(),
        qty: 0,
        amount: 0,
        bills: new Set(),
        variants: [],
      }
      map.set(l.item_id, g)
    }
    if (g.line_type !== l.line_type) g.mixedType = true
    g.units.add(l.unit_abbreviation)
    g.qty += l.qty
    g.amount += l.line_total
    g.bills.add(l.bill_id)

    const vKey = `${l.variant_id ?? 'base'}|${l.unit_abbreviation}`
    let v = g.variants.find(x => x.key === vKey)
    if (!v) {
      v = { key: vKey, variant_name: l.variant_name, unit: l.unit_abbreviation, qty: 0, amount: 0, bills: new Set() }
      g.variants.push(v)
    }
    v.qty += l.qty
    v.amount += l.line_total
    v.bills.add(l.bill_id)
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount)
}

// ── Interleaved timeline ───────────────────────────────────────────────────
type TimelineRow =
  | { kind: 'item'; key: string; ts: string; line: CustomerItemLine }
  | { kind: 'cash'; key: string; ts: string; entry: CustomerStatementEntry }

export default function CustomerItemReportPage({ customer, onBack }: Props) {
  const { t, fmtAmt, fmtDate } = useLanguage()

  const [lines, setLines] = useState<CustomerItemLine[] | null>(null)
  const [statement, setStatement] = useState<CustomerStatementEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [preset, setPreset] = useState<DatePreset>('all')
  const [fromDate, setFromDate] = useState(() => bsMonthStartISO())
  const [toDate, setToDate] = useState(isoToday())
  const [view, setView] = useState<ViewMode>('all')

  const [itemQuery, setItemQuery] = useState('')
  const [showItemDrop, setShowItemDrop] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  // The whole history of one customer is small, so it ships once and every
  // filter below runs in memory — no IPC round-trip per keystroke.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      window.api.bills.getCustomerItemLines(customer.id),
      window.api.bills.getCustomerStatement(customer.id),
    ])
      .then(([linesRes, stmtRes]) => {
        if (cancelled) return
        if (linesRes.ok) setLines(linesRes.data ?? [])
        else setError(linesRes.error ?? t('reports.error'))
        if (stmtRes.ok) setStatement(stmtRes.data ?? [])
        else setError(stmtRes.error ?? t('reports.error'))
      })
      .catch(e => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [customer.id])

  function applyPreset(p: DatePreset) {
    setPreset(p)
    if (p === 'today') { setFromDate(isoToday()); setToDate(isoToday()) }
    else if (p === 'month') { setFromDate(bsMonthStartISO()); setToDate(isoToday()) }
  }

  function inRange(ts: string) {
    if (preset === 'all') return true
    const d = dayOf(ts)
    return d >= fromDate && d <= toDate
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase()

  const dateLines = useMemo(
    () => (lines ?? []).filter(l => inRange(l.created_at)),
    [lines, preset, fromDate, toDate]
  )

  // Cash side of the statement: everything that is not the bill charge itself.
  const dateCash = useMemo(
    () => (statement ?? []).filter(e => e.kind !== 'sale' && inRange(e.created_at)),
    [statement, preset, fromDate, toDate]
  )

  const filteredLines = useMemo(() => dateLines.filter(l => {
    if (selectedItemId !== null && l.item_id !== selectedItemId) return false
    if (!q) return true
    return (
      l.item_name.toLowerCase().includes(q) ||
      (l.variant_name ?? '').toLowerCase().includes(q) ||
      l.bill_number.toLowerCase().includes(q)
    )
  }), [dateLines, selectedItemId, q])

  // A cash row belongs to no item, so narrowing to one item hides the cash side.
  const filteredCash = useMemo(() => {
    if (selectedItemId !== null) return []
    if (!q) return dateCash
    return dateCash.filter(e =>
      e.description.toLowerCase().includes(q) ||
      (e.bill_number ?? '').toLowerCase().includes(q)
    )
  }, [dateCash, selectedItemId, q])

  const groups = useMemo(() => groupByItem(filteredLines), [filteredLines])

  const itemSuggestions = useMemo(() => {
    const seen = new Map<number, string>()
    for (const l of dateLines) if (!seen.has(l.item_id)) seen.set(l.item_id, l.item_name)
    const needle = itemQuery.trim().toLowerCase()
    return Array.from(seen.entries())
      .filter(([, name]) => !needle || name.toLowerCase().includes(needle))
      .slice(0, 12)
  }, [dateLines, itemQuery])

  const totals = useMemo(() => {
    const itemsValue = filteredLines.reduce((s, l) => s + l.line_total, 0)
    const cashIn = filteredCash.reduce((s, e) => s + e.credit, 0)
    const otherCharges = filteredCash.reduce((s, e) => s + e.debit, 0)
    return { itemsValue, cashIn, otherCharges, net: itemsValue + otherCharges - cashIn }
  }, [filteredLines, filteredCash])

  const timeline = useMemo<TimelineRow[]>(() => {
    const rows: TimelineRow[] = []
    if (view !== 'cash') {
      for (const l of filteredLines) rows.push({ kind: 'item', key: `i${l.line_id}`, ts: l.created_at, line: l })
    }
    if (view !== 'items') {
      for (const e of filteredCash) rows.push({ kind: 'cash', key: `c${e.id}`, ts: e.created_at, entry: e })
    }
    // Newest first. Ledger ids and bill-line ids both ascend with time, so they
    // break same-second ties deterministically.
    return rows.sort((a, b) => (a.ts === b.ts ? b.key.localeCompare(a.key) : (a.ts < b.ts ? 1 : -1)))
  }, [filteredLines, filteredCash, view])

  function toggle(itemId: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId)
      return next
    })
  }

  function clearItem() {
    setSelectedItemId(null)
    setItemQuery('')
    setShowItemDrop(false)
  }

  const filtersActive = preset !== 'all' || selectedItemId !== null || q !== '' || view !== 'all'
  const grandQty = groups.length === 1 && groups[0].units.size === 1 ? groups[0].qty : null

  return (
    <div className="cir-page">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="cir-topbar">
        <button className="btn-ghost btn-sm cir-back" onClick={onBack}>
          <ArrowLeft size={14} />
          {t('citem.back')}
        </button>
        <div className="cir-title-wrap">
          <ListTree size={16} className="cir-title-icon" />
          <h2>{t('citem.title')}</h2>
        </div>
      </div>

      {/* ── Customer summary ────────────────────────────────── */}
      <div className="cir-summary-card">
        <div className="cir-cust">
          <span className="cir-cust-name">{customer.name}</span>
          {customer.phone && <span className="cir-cust-meta">{customer.phone}</span>}
          {customer.address && <span className="cir-cust-meta cir-cust-addr">{customer.address}</span>}
        </div>
        <div className="cir-stats">
          <div className="cir-stat">
            <div className="cir-stat-label">{t('customer.total_billed')}</div>
            <div className="cir-stat-value">{fmtAmt(customer.total_billed)}</div>
          </div>
          <div className="cir-stat">
            <div className="cir-stat-label">{t('customer.total_paid')}</div>
            <div className="cir-stat-value" style={{ color: '#15803d' }}>{fmtAmt(customer.total_paid)}</div>
          </div>
          <div className="cir-stat">
            <div className="cir-stat-label">{t('customer.outstanding')}</div>
            <div
              className="cir-stat-value"
              style={{ color: customer.outstanding > 0.005 ? '#dc2626' : '#15803d' }}
            >
              {customer.outstanding < -0.005
                ? `${t('customer.credit')}: ${fmtAmt(Math.abs(customer.outstanding))}`
                : fmtAmt(customer.outstanding)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="cir-filter-card">
        <div className="cir-preset-group">
          {([
            ['all', t('citem.all_time')],
            ['month', t('reports.this_month')],
            ['today', t('reports.today')],
          ] as [DatePreset, string][]).map(([p, label]) => (
            <button
              key={p}
              className={`cir-pill${preset === p ? ' cir-pill--active' : ''}`}
              onClick={() => applyPreset(p)}
            >{label}</button>
          ))}
          {preset === 'custom' && <span className="cir-pill cir-pill--active">{t('reports.custom')}</span>}
        </div>

        <div className="cir-divider" />

        {(['from', 'to'] as const).map(side => {
          const val = side === 'from' ? fromDate : toDate
          return (
            <div
              key={side}
              className={`cir-date-field${preset === 'custom' ? ' cir-date-field--active' : ''}`}
            >
              <span className="cir-micro-label">{side === 'from' ? t('reports.from') : t('reports.to')}</span>
              <span className="cir-date-bs">{preset === 'all' ? '—' : fmtDate(val)}</span>
              <input
                type="date"
                value={val}
                onChange={e => {
                  if (side === 'from') setFromDate(e.target.value); else setToDate(e.target.value)
                  setPreset('custom')
                }}
              />
            </div>
          )
        })}

        <div className="cir-divider" />

        <div className="cir-combo">
          <input
            type="text"
            className="search-input cir-input"
            placeholder={t('citem.filter_item')}
            value={itemQuery}
            onChange={e => { setItemQuery(e.target.value); setSelectedItemId(null); setShowItemDrop(true) }}
            onFocus={() => setShowItemDrop(true)}
            onBlur={() => setTimeout(() => setShowItemDrop(false), 150)}
            style={{ paddingRight: itemQuery ? '2rem' : undefined }}
          />
          {itemQuery && <button className="cir-clear" onClick={clearItem}>×</button>}
          {showItemDrop && itemSuggestions.length > 0 && (
            <ul className="dropdown-list">
              {itemSuggestions.map(([id, name]) => (
                <li
                  key={id}
                  onMouseDown={() => { setSelectedItemId(id); setItemQuery(name); setShowItemDrop(false) }}
                >
                  <span>{name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cir-combo cir-combo--search">
          <Search size={13} className="cir-search-icon" />
          <input
            type="text"
            className="search-input cir-input cir-input--icon"
            placeholder={t('citem.search_ph')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="cir-preset-group cir-view-group">
          {([
            ['all', t('common.all')],
            ['items', t('citem.view_items')],
            ['cash', t('citem.view_cash')],
          ] as [ViewMode, string][]).map(([v, label]) => (
            <button
              key={v}
              className={`cir-pill${view === v ? ' cir-pill--active' : ''}`}
              onClick={() => setView(v)}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* ── Filter-scoped chips ─────────────────────────────── */}
      <div className="cir-chips">
        <Chip label={t('citem.lines_count')} value={String(filteredLines.length)} />
        <Chip label={t('citem.items_value')} value={fmtAmt(totals.itemsValue)} tone="orange" />
        <Chip label={t('citem.cash_received')} value={fmtAmt(totals.cashIn)} tone="green" />
        <Chip
          label={t('citem.net')}
          value={
            Math.abs(totals.net) <= 0.005
              ? fmtAmt(0)
              : `${fmtAmt(Math.abs(totals.net))} ${totals.net > 0 ? t('citem.dr') : t('citem.cr')}`
          }
          tone={totals.net > 0.005 ? 'red' : 'green'}
        />
      </div>

      {loading && <p className="text-muted">{t('common.loading')}</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && (
        <>
          {/* ── Per-item totals ───────────────────────────────── */}
          <section className="cir-section">
            <h3 className="cir-section-title">{t('citem.per_item')}</h3>
            {groups.length === 0 ? (
              <div className="empty-state">{t('citem.no_items')}</div>
            ) : (
              <div className="cir-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('reports.item_col')}</th>
                      <th className="cir-col-type">{t('citem.type_col')}</th>
                      <th style={{ textAlign: 'right' }}>{t('reports.qty_col')}</th>
                      <th className="cir-col-bills" style={{ textAlign: 'right' }}>{t('citem.bills_col')}</th>
                      <th style={{ textAlign: 'right' }}>{t('reports.amount_col')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(g => {
                      const multi = g.variants.length > 1 ||
                        (g.variants.length === 1 && g.variants[0].variant_name !== null &&
                         g.variants[0].variant_name !== g.item_name)
                      const collapsed = !expanded.has(g.item_id)
                      const unit = g.units.size === 1 ? Array.from(g.units)[0] : ''
                      return [
                        <tr key={`g${g.item_id}`} className={multi ? 'report-item-row report-item-row--multi' : 'report-item-row'}>
                          <td style={{ fontWeight: 700, color: '#1c1917' }}>
                            {multi
                              ? <button className="report-expand-btn" onClick={() => toggle(g.item_id)}>{collapsed ? '+' : '−'}</button>
                              : <span className="report-expand-placeholder" />}
                            {g.item_name}
                          </td>
                          <td className="cir-col-type">
                            {g.mixedType
                              ? <TypeBadge spec={{ labelKey: 'citem.type_mixed', bg: '#f5f0eb', fg: '#57534e' }} t={t} />
                              : <TypeBadge spec={badgeFor(g.line_type, g.category)} t={t} />}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {unit ? `${fmtQty(g.qty)} ${unit}` : '—'}
                          </td>
                          <td className="cir-col-bills" style={{ textAlign: 'right', color: '#78716c' }}>{g.bills.size}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#ea580c' }}>{fmtAmt(g.amount)}</td>
                        </tr>,
                        ...(multi && !collapsed ? g.variants.map(v => (
                          <tr key={`g${g.item_id}-${v.key}`} className="report-variant-row">
                            <td>
                              <span className="report-expand-placeholder" />
                              <span style={{ color: '#a8a29e', marginRight: '0.4rem', fontSize: '0.8rem' }}>└</span>
                              <span>{v.variant_name ?? g.item_name}</span>
                            </td>
                            <td className="cir-col-type" />
                            <td style={{ textAlign: 'right' }}>{fmtQty(v.qty)} {v.unit}</td>
                            <td className="cir-col-bills" style={{ textAlign: 'right', color: '#a8a29e' }}>{v.bills.size}</td>
                            <td style={{ textAlign: 'right' }}>{fmtAmt(v.amount)}</td>
                          </tr>
                        )) : []),
                      ]
                    })}
                    <tr className="report-grand-total-row">
                      <td>{t('reports.grand_total')}</td>
                      <td className="cir-col-type" />
                      <td style={{ textAlign: 'right' }}>
                        {grandQty !== null ? `${fmtQty(grandQty)} ${Array.from(groups[0].units)[0]}` : ''}
                      </td>
                      <td className="cir-col-bills" />
                      <td style={{ textAlign: 'right' }}>{fmtAmt(totals.itemsValue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Interleaved timeline ──────────────────────────── */}
          <section className="cir-section">
            <h3 className="cir-section-title">
              {t('citem.timeline')}
              <span className="cir-legend">
                <span className="cir-legend-dot cir-legend-dot--item" />{t('citem.view_items')}
                <span className="cir-legend-dot cir-legend-dot--cash" />{t('citem.view_cash')}
              </span>
            </h3>
            {timeline.length === 0 ? (
              <div className="empty-state">
                {filtersActive ? t('citem.no_rows_filtered') : t('citem.no_rows')}
              </div>
            ) : (
              <div className="cir-table-wrap">
                <table className="data-table cir-timeline">
                  <thead>
                    <tr>
                      <th>{t('citem.bill_col')}</th>
                      <th className="cir-col-type">{t('citem.type_col')}</th>
                      <th>{t('citem.detail_col')}</th>
                      <th style={{ textAlign: 'right' }}>{t('reports.qty_col')}</th>
                      <th className="cir-col-rate" style={{ textAlign: 'right' }}>{t('reports.rate_col')}</th>
                      <th style={{ textAlign: 'right' }}>{t('reports.amount_col')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((row, idx) => {
                      const prev = idx > 0 ? timeline[idx - 1] : null
                      const newDay = !prev || dayOf(prev.ts) !== dayOf(row.ts)
                      const dayRow = newDay
                        ? <tr key={`d${row.key}`} className="cir-day-row">
                            <td colSpan={6}>{fmtDate(row.ts)}</td>
                          </tr>
                        : null

                      if (row.kind === 'item') {
                        const l = row.line
                        const showVariant = l.variant_name && l.variant_name !== l.item_name
                        return [
                          dayRow,
                          <tr key={row.key}>
                            <td>
                              <span className="bill-number-badge">{l.bill_number}</span>
                              {l.business_name && <div className="cir-biz">{l.business_name}</div>}
                            </td>
                            <td className="cir-col-type">
                              <TypeBadge spec={badgeFor(l.line_type, l.item_category)} t={t} />
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{l.item_name}</span>
                              {showVariant && <span className="cir-variant">({l.variant_name})</span>}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {fmtQty(l.qty)} <span className="cir-unit">{l.unit_abbreviation}</span>
                            </td>
                            <td className="cir-col-rate" style={{ textAlign: 'right', color: '#78716c' }}>
                              {fmtAmt(l.rate_snapshot)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#c2410c' }}>
                              {fmtAmt(l.line_total)}
                            </td>
                          </tr>,
                        ]
                      }

                      const e = row.entry
                      const isCredit = e.credit > 0.005
                      return [
                        dayRow,
                        <tr key={row.key} className="cir-cash-row">
                          <td>
                            {e.bill_number
                              ? <span className="bill-number-badge">{e.bill_number}</span>
                              : <span className="cir-cash-dash">—</span>}
                          </td>
                          <td className="cir-col-type">
                            <TypeBadge spec={cashBadgeFor(e.kind)} t={t} />
                          </td>
                          <td style={{ fontWeight: 600, color: isCredit ? '#15803d' : '#b91c1c' }}>
                            {e.description}
                          </td>
                          <td />
                          <td className="cir-col-rate" />
                          <td style={{ textAlign: 'right', fontWeight: 700, color: isCredit ? '#15803d' : '#b91c1c' }}>
                            {fmtAmt(isCredit ? e.credit : e.debit)} {isCredit ? t('citem.cr') : t('citem.dr')}
                          </td>
                        </tr>,
                      ]
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function TypeBadge({ spec, t }: { spec: BadgeSpec; t: (k: string) => string }) {
  return (
    <span className="cir-badge" style={{ background: spec.bg, color: spec.fg }}>
      {t(spec.labelKey)}
    </span>
  )
}

function Chip({ label, value, tone }: { label: string; value: string; tone?: 'orange' | 'green' | 'red' }) {
  const color = tone === 'orange' ? '#c2410c' : tone === 'green' ? '#15803d' : tone === 'red' ? '#dc2626' : '#1c1917'
  return (
    <div className="cir-chip">
      <div className="cir-chip-label">{label}</div>
      <div className="cir-chip-value" style={{ color }}>{value}</div>
    </div>
  )
}

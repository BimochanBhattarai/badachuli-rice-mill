import { useEffect, useRef, useState } from 'react'
import type {
  AuthUser, SupplierRow, ItemRow, VariantRow, UnitRow,
  PurchaseLineInput, PurchaseWithSupplier, PurchaseLineWithDetail,
} from '../../../shared/types/api'

interface Props { currentUser: AuthUser }

interface DraftLine extends PurchaseLineInput {
  itemName: string
  variantName: string | null
  unitAbbr: string
}

export default function StockInPage({ currentUser }: Props) {
  // Supplier picker
  const [supplier, setSupplier] = useState<SupplierRow | null>(null)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierResults, setSupplierResults] = useState<SupplierRow[]>([])
  const [showSupplierDrop, setShowSupplierDrop] = useState(false)

  // Item entry
  const [itemSearch, setItemSearch] = useState('')
  const [itemResults, setItemResults] = useState<ItemRow[]>([])
  const [showItemDrop, setShowItemDrop] = useState(false)
  const [pendingItem, setPendingItem] = useState<ItemRow | null>(null)
  const [pendingVariants, setPendingVariants] = useState<VariantRow[]>([])
  const [pendingUnits, setPendingUnits] = useState<UnitRow[]>([])
  const [pendingVariantId, setPendingVariantId] = useState('')
  const [pendingUnitId, setPendingUnitId] = useState('')
  const [pendingQty, setPendingQty] = useState('')
  const [pendingRate, setPendingRate] = useState('')

  const [lines, setLines] = useState<DraftLine[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Purchase history
  const [purchases, setPurchases] = useState<PurchaseWithSupplier[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [linesCache, setLinesCache] = useState<Record<number, PurchaseLineWithDetail[]>>({})

  const itemSearchRef = useRef<HTMLInputElement>(null)

  async function loadPurchases() {
    const res = await window.api.purchases.getAll(50)
    if (res.ok && res.data) setPurchases(res.data)
  }

  useEffect(() => { loadPurchases() }, [])

  // Supplier search
  useEffect(() => {
    if (!supplierSearch.trim()) { setSupplierResults([]); return }
    window.api.suppliers.search(supplierSearch).then(r => {
      if (r.ok && r.data) setSupplierResults(r.data)
    })
  }, [supplierSearch])

  // Item search — buyable items only
  useEffect(() => {
    if (!itemSearch.trim()) { setItemResults([]); setShowItemDrop(false); return }
    window.api.items.search(itemSearch, { buyable: true }).then(r => {
      if (r.ok && r.data) { setItemResults(r.data); setShowItemDrop(true) }
    })
  }, [itemSearch])

  async function selectSupplier(s: SupplierRow) {
    setSupplier(s); setSupplierSearch(s.name)
    setShowSupplierDrop(false); setSupplierResults([])
  }

  function clearSupplier() {
    setSupplier(null); setSupplierSearch(''); setSupplierResults([])
  }

  async function selectItem(item: ItemRow) {
    setPendingItem(item); setItemSearch(item.name); setShowItemDrop(false)

    const [vRes, uRes, priceRes] = await Promise.all([
      window.api.variants.getByItem(item.id),
      window.api.units.getAll(),
      window.api.prices.getCurrent(item.id),
    ])
    const variants = (vRes.data ?? []).filter(v => v.is_active)
    const units = uRes.data ?? []
    const defVariant = variants.find(v => v.is_default) ?? variants[0]
    const defUnit = units.find(u => u.id === item.default_unit_id) ?? units.find(u => u.is_default) ?? units[0]

    setPendingVariants(variants)
    setPendingUnits(units)
    setPendingVariantId(defVariant ? String(defVariant.id) : '')
    setPendingUnitId(defUnit ? String(defUnit.id) : '')
    setPendingQty('')

    // Pre-fill last buy price
    const vid = defVariant?.id ?? null
    const uid = defUnit?.id
    const price = (priceRes.data ?? []).find(
      p => p.price_type === 'buy' && p.unit_id === uid &&
           (vid ? p.variant_id === vid : p.variant_id === null)
    )
    setPendingRate(price ? String(price.price) : '')
  }

  function addLine() {
    if (!pendingItem) return
    const qty = parseFloat(pendingQty)
    const rate = parseFloat(pendingRate)
    if (isNaN(qty) || qty <= 0 || isNaN(rate) || rate < 0) return

    const variant = pendingVariants.find(v => v.id === parseInt(pendingVariantId))
    const unit = pendingUnits.find(u => u.id === parseInt(pendingUnitId))

    setLines(prev => [...prev, {
      itemId: pendingItem!.id,
      variantId: pendingVariantId ? parseInt(pendingVariantId) : null,
      qty,
      unitId: parseInt(pendingUnitId),
      rate,
      lineTotal: qty * rate,
      itemName: pendingItem!.name,
      variantName: variant?.name ?? null,
      unitAbbr: unit?.abbreviation ?? '',
    }])

    setPendingItem(null); setItemSearch('')
    setPendingVariants([]); setPendingQty(''); setPendingRate('')
    itemSearchRef.current?.focus()
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx))
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)

  async function savePurchase() {
    setError('')
    if (!supplier) { setError('Select a supplier'); return }
    if (!lines.length) { setError('Add at least one item'); return }
    setSaving(true)
    try {
      const res = await window.api.purchases.create({
        supplierId: supplier.id,
        lines: lines.map(({ itemName: _a, variantName: _b, unitAbbr: _c, ...l }) => l),
        notes: notes || undefined,
        operatorId: currentUser.id,
      })
      if (!res.ok) { setError(res.error ?? 'Error'); return }
      setSuccessMsg(`Purchase #${res.data!.orderId} recorded — stock updated`)
      setLines([]); setSupplier(null); setSupplierSearch(''); setNotes('')
      loadPurchases()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IPC error — restart the app')
    } finally {
      setSaving(false)
    }
  }

  async function toggleExpand(id: number) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!linesCache[id]) {
      const res = await window.api.purchases.getLines(id)
      if (res.ok && res.data) setLinesCache(prev => ({ ...prev, [id]: res.data! }))
    }
  }

  function fmt(n: number) { return n.toLocaleString('en-NP', { minimumFractionDigits: 2 }) }
  function fmtDate(s: string) {
    return new Date(s).toLocaleDateString('en-NP', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="catalog-page">
      {/* ── Entry form ──────────────────────────────────────── */}
      <div className="inline-form" style={{ marginBottom: '1.5rem' }}>
        <div className="catalog-header" style={{ marginBottom: '0.75rem' }}>
          <h3>Record Stock-In</h3>
        </div>

        {error && <p className="form-error">{error}</p>}
        {successMsg && <p className="success-msg" style={{ marginBottom: '0.5rem' }}>{successMsg}</p>}

        {/* Supplier picker */}
        <div style={{ marginBottom: '0.75rem' }}>
          {supplier ? (
            <div className="customer-selected">
              <span style={{ fontWeight: 600 }}>{supplier.name}</span>
              {supplier.phone && <span className="text-muted">{supplier.phone}</span>}
              <button className="btn-ghost btn-sm" onClick={clearSupplier}>✕</button>
            </div>
          ) : (
            <div className="customer-search-wrap">
              <input
                type="text" placeholder="Search supplier…"
                value={supplierSearch}
                onChange={e => { setSupplierSearch(e.target.value); setShowSupplierDrop(true) }}
                onFocus={() => setShowSupplierDrop(true)}
                onBlur={() => setTimeout(() => setShowSupplierDrop(false), 150)}
                className="search-input"
              />
              {showSupplierDrop && supplierResults.length > 0 && (
                <ul className="dropdown-list">
                  {supplierResults.map(s => (
                    <li key={s.id} onMouseDown={() => selectSupplier(s)}>
                      <span>{s.name}</span>
                      {s.phone && <span className="text-muted">{s.phone}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Item entry row */}
        <div className="item-entry-row">
          <div className="item-search-wrap" style={{ flex: 2 }}>
            <input
              ref={itemSearchRef}
              type="text" placeholder="Search item to add…"
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              onFocus={() => itemResults.length > 0 && setShowItemDrop(true)}
              onBlur={() => setTimeout(() => setShowItemDrop(false), 150)}
              className="search-input" autoFocus
            />
            {showItemDrop && itemResults.length > 0 && (
              <ul className="dropdown-list">
                {itemResults.map(i => (
                  <li key={i.id} onMouseDown={() => selectItem(i)}>
                    <span>{i.name}</span>
                    <span className="text-muted">{i.unit_abbreviation}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {pendingItem && (
            <>
              {pendingVariants.length > 1 && (
                <select value={pendingVariantId} onChange={e => setPendingVariantId(e.target.value)} style={{ flex: 1 }}>
                  {pendingVariants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              )}
              <input type="number" step="any" min="0.001" placeholder="Qty"
                value={pendingQty} onChange={e => setPendingQty(e.target.value)}
                style={{ flex: '0 0 90px' }} autoFocus />
              <select value={pendingUnitId} onChange={e => setPendingUnitId(e.target.value)}
                style={{ flex: '0 0 90px' }}>
                {pendingUnits.map(u => <option key={u.id} value={u.id}>{u.abbreviation}</option>)}
              </select>
              <input type="number" step="0.01" min="0" placeholder="Rate (Rs.)"
                value={pendingRate} onChange={e => setPendingRate(e.target.value)}
                style={{ flex: '0 0 110px' }} />
              <button className="btn-primary btn-sm" onClick={addLine}>Add</button>
            </>
          )}
        </div>

        {/* Draft lines */}
        {lines.length > 0 && (
          <>
            <table className="data-table" style={{ marginTop: '0.75rem' }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td>
                      {l.itemName}
                      {l.variantName && l.variantName !== l.itemName && (
                        <span className="text-muted"> · {l.variantName}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>{l.qty} {l.unitAbbr}</td>
                    <td style={{ textAlign: 'right' }}>Rs. {l.rate.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs. {fmt(l.lineTotal)}</td>
                    <td><button className="btn-danger btn-sm" onClick={() => removeLine(i)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', gap: '1rem' }}>
              <label style={{ flex: 1, fontSize: '0.875rem', color: '#9ca3af' }}>
                Notes (optional)
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. received from truck, moisture high" style={{ display: 'block', width: '100%', marginTop: '0.25rem' }} />
              </label>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Total</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>Rs. {fmt(subtotal)}</div>
                <button
                  className="btn-primary"
                  style={{ marginTop: '0.5rem', padding: '0.5rem 1.5rem' }}
                  onClick={savePurchase} disabled={saving}
                >
                  {saving ? 'Saving…' : 'Record Stock-In'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Purchase history ────────────────────────────────── */}
      <h3 style={{ color: '#9ca3af', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
        Purchase History
      </h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Supplier</th>
            <th style={{ textAlign: 'right' }}>Items</th>
            <th style={{ textAlign: 'right' }}>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {purchases.length === 0 && (
            <tr><td colSpan={5} className="empty-state">No purchases recorded yet</td></tr>
          )}
          {purchases.map(p => (
            <>
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(p.id)}>
                <td className="text-muted">{fmtDate(p.created_at)}</td>
                <td style={{ fontWeight: 600 }}>{p.supplier_name}</td>
                <td style={{ textAlign: 'right' }}>{p.line_count}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs. {fmt(p.total_amount)}</td>
                <td className="row-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn-ghost btn-sm">{expandedId === p.id ? '▲' : '▼'}</button>
                </td>
              </tr>
              {expandedId === p.id && (
                <tr key={`${p.id}-detail`}>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <div style={{ padding: '0.5rem 1.5rem 0.75rem', background: 'var(--bg-subtle)' }}>
                      <table className="data-table" style={{ marginTop: 0 }}>
                        <thead>
                          <tr><th>Item</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Total</th></tr>
                        </thead>
                        <tbody>
                          {!linesCache[p.id] && <tr><td colSpan={4} className="empty-state">Loading…</td></tr>}
                          {linesCache[p.id]?.map(l => (
                            <tr key={l.id}>
                              <td>
                                {l.item_name}
                                {l.variant_name && l.variant_name !== l.item_name && (
                                  <span className="text-muted"> · {l.variant_name}</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>{l.qty} {l.unit_abbreviation}</td>
                              <td style={{ textAlign: 'right' }}>Rs. {l.rate.toLocaleString()}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs. {fmt(l.line_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {p.notes && <p style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>Note: {p.notes}</p>}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

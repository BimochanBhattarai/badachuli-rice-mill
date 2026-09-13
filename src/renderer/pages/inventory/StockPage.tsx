import { useEffect, useState } from 'react'
import { Plus, X, Pencil, Check } from 'lucide-react'
import type { AuthUser, ItemRow, VariantRow, UnitRow, StockLevel, CurrentPrice } from '../../../shared/types/api'
import { useLanguage } from '../../i18n'

interface Props {
  currentUser: AuthUser
}

interface EntryRow {
  itemId: string
  variantId: string
  unitId: string
  qty: string
  price: string
  notes: string
  // resolved for display
  item: ItemRow | null
  variants: VariantRow[]
  units: UnitRow[]
  originalPrice: string
  saving: boolean
  saved: boolean
  error: string
}

function blankEntry(units: UnitRow[]): EntryRow {
  const defUnit = units.find(u => u.is_default) ?? units[0]
  return {
    itemId: '', variantId: '', unitId: defUnit ? String(defUnit.id) : '',
    qty: '', price: '', notes: '',
    item: null, variants: [], units,
    originalPrice: '', saving: false, saved: false, error: '',
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function StockPage({ currentUser }: Props) {
  const { t } = useLanguage()
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([])
  const [allItems, setAllItems] = useState<ItemRow[]>([])
  const [allUnits, setAllUnits] = useState<UnitRow[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [globalError, setGlobalError] = useState('')
  const [savingAll, setSavingAll] = useState(false)

  const [editKey, setEditKey] = useState<string | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  async function loadStock() {
    const res = await window.api.inventory.getAll()
    if (res.ok && res.data) setStockLevels(res.data)
  }

  async function loadMeta() {
    const [uRes, iRes] = await Promise.all([
      window.api.units.getAll(),
      window.api.items.search('', { stockable: true }),
    ])
    const units = uRes.data ?? []
    const items = iRes.data ?? []
    setAllUnits(units)
    setAllItems(items)
    return { units, items }
  }

  useEffect(() => {
    loadStock()
    loadMeta()
  }, [])

  function openForm() {
    setGlobalError('')
    setEntries([blankEntry(allUnits)])
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEntries([])
    setGlobalError('')
  }

  function addRow() {
    setEntries(prev => [...prev, blankEntry(allUnits)])
  }

  async function fetchPrice(itemId: number, variantId: number | null, unitId: number) {
    const res = await window.api.prices.getCurrent(itemId)
    if (!res.ok || !res.data) return ''
    const match = res.data.find(
      (p: CurrentPrice) =>
        p.price_type === 'buy' && p.unit_id === unitId &&
        (variantId ? p.variant_id === variantId : p.variant_id === null)
    )
    return match ? String(match.price) : ''
  }

  async function onItemChange(idx: number, itemId: string) {
    if (!itemId) {
      setEntries(prev => prev.map((e, i) => i === idx
        ? { ...e, itemId: '', variantId: '', item: null, variants: [], originalPrice: '', price: '' }
        : e))
      return
    }
    const item = allItems.find(it => String(it.id) === itemId) ?? null
    const vRes = await window.api.variants.getByItem(parseInt(itemId))
    const variants = (vRes.data ?? []).filter((v: VariantRow) => v.is_active)
    const defVariant = variants.find((v: VariantRow) => v.is_default) ?? variants[0]
    const unitId = item ? item.default_unit_id : parseInt(entries[idx].unitId)
    const variantId = defVariant ? defVariant.id : null
    const price = await fetchPrice(parseInt(itemId), variantId, unitId)
    setEntries(prev => prev.map((e, i) => i === idx ? {
      ...e, itemId, variantId: defVariant ? String(defVariant.id) : '',
      unitId: String(unitId), item, variants, originalPrice: price, price,
    } : e))
  }

  async function onVariantChange(idx: number, variantId: string) {
    const e = entries[idx]
    if (!e.itemId) return
    const price = await fetchPrice(parseInt(e.itemId), variantId ? parseInt(variantId) : null, parseInt(e.unitId))
    setEntries(prev => prev.map((en, i) => i === idx ? { ...en, variantId, originalPrice: price, price } : en))
  }

  async function onUnitChange(idx: number, unitId: string) {
    const e = entries[idx]
    if (!e.itemId) return
    const price = await fetchPrice(parseInt(e.itemId), e.variantId ? parseInt(e.variantId) : null, parseInt(unitId))
    setEntries(prev => prev.map((en, i) => i === idx ? { ...en, unitId, originalPrice: price, price } : en))
  }

  function patchEntry(idx: number, patch: Partial<EntryRow>) {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e))
  }

  function removeRow(idx: number) {
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }

  async function saveAll() {
    setGlobalError('')
    setSavingAll(true)
    let anyError = false
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      if (e.saved) continue
      const qty = parseFloat(e.qty)
      const itemId = parseInt(e.itemId)
      const unitId = parseInt(e.unitId)
      if (!e.itemId || isNaN(itemId)) { patchEntry(i, { error: 'Select an item' }); anyError = true; continue }
      if (isNaN(qty) || qty <= 0) { patchEntry(i, { error: 'Qty must be > 0' }); anyError = true; continue }
      if (!unitId) { patchEntry(i, { error: 'Select a unit' }); anyError = true; continue }
      const item = e.item
      if (!item) { patchEntry(i, { error: 'Item not found' }); anyError = true; continue }
      const variantId = e.variantId ? parseInt(e.variantId) : null
      const price = e.price !== '' ? parseFloat(e.price) : null
      patchEntry(i, { saving: true, error: '' })
      try {
        const invCategory = item.category === 'consumable' ? 'raw_material' : item.category
        const stockRes = await window.api.inventory.addOpening(
          itemId, variantId, unitId, qty, invCategory, currentUser.id, e.notes || undefined
        )
        if (!stockRes.ok) { patchEntry(i, { saving: false, error: stockRes.error ?? 'Error' }); anyError = true; continue }
        if (price !== null && String(price) !== e.originalPrice) {
          await window.api.prices.set(itemId, variantId, unitId, price, 'buy', today())
        }
        patchEntry(i, { saving: false, saved: true, error: '' })
      } catch (err) {
        patchEntry(i, { saving: false, error: err instanceof Error ? err.message : 'IPC error' })
        anyError = true
      }
    }
    setSavingAll(false)
    if (!anyError) {
      await loadStock()
      closeForm()
    } else {
      loadStock()
    }
  }

  function stockRowKey(s: StockLevel) {
    return `${s.item_id}-${s.variant_id ?? 0}-${s.unit_id}`
  }

  function startEdit(s: StockLevel) {
    setEditKey(stockRowKey(s))
    setEditQty(String(Number(s.balance).toFixed(3)).replace(/\.?0+$/, ''))
    setEditError('')
  }

  function cancelEdit() {
    setEditKey(null)
    setEditQty('')
    setEditError('')
  }

  async function saveEdit(s: StockLevel) {
    const newQty = parseFloat(editQty)
    if (isNaN(newQty) || newQty < 0) { setEditError('Enter a valid quantity (≥ 0)'); return }
    setEditSaving(true)
    setEditError('')
    try {
      const res = await window.api.inventory.adjust(
        s.item_id, s.variant_id, s.unit_id, newQty, currentUser.id
      )
      if (!res.ok) { setEditError(res.error ?? 'Error'); return }
      cancelEdit()
      await loadStock()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setEditSaving(false)
    }
  }

  const filtered = search
    ? stockLevels.filter(s =>
        s.item_name.toLowerCase().includes(search.toLowerCase()) ||
        (s.variant_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : stockLevels

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <h2>{t('stock.title')}</h2>
        <button className="btn-primary" onClick={openForm}>{t('stock.add')}</button>
      </div>

      {/* ── Opening Stock form ────────────────────────────────── */}
      {showForm && (
        <div className="opening-stock-panel">
          <div className="opening-stock-header">
            <span>{t('stock.form_title')}</span>
            <button className="btn-ghost btn-sm" onClick={closeForm} style={{ marginLeft: 'auto' }}>
              <X size={14} /> Close
            </button>
          </div>
          {globalError && <p className="form-error">{globalError}</p>}

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table opening-stock-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>{t('stock.item')}</th>
                  <th style={{ minWidth: 110 }}>{t('stock.variant')}</th>
                  <th style={{ minWidth: 80 }}>{t('stock.unit')}</th>
                  <th style={{ minWidth: 90 }}>{t('stock.qty')}</th>
                  <th style={{ minWidth: 100 }}>{t('stock.buy_price')}</th>
                  <th style={{ minWidth: 140 }}>{t('common.notes')}</th>
                  <th style={{ width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, idx) => (
                  <tr key={idx} style={{ background: e.saved ? '#f0fdf4' : undefined }}>
                    <td>
                      {e.saved ? (
                        <span style={{ fontWeight: 600, color: '#15803d' }}>{e.item?.name}</span>
                      ) : (
                        <>
                          <select
                            value={e.itemId}
                            onChange={ev => onItemChange(idx, ev.target.value)}
                            autoFocus={idx === 0}
                          >
                            <option value="">— Select item —</option>
                            {allItems.map(it => (
                              <option key={it.id} value={it.id}>{it.name}</option>
                            ))}
                          </select>
                          {e.error && <div className="form-error" style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', padding: '0.1rem 0' }}>{e.error}</div>}
                        </>
                      )}
                    </td>
                    <td>
                      {e.saved ? (
                        <span className="text-muted">{e.variants.find(v => String(v.id) === e.variantId)?.name ?? '—'}</span>
                      ) : e.variants.length > 0 ? (
                        <select value={e.variantId} onChange={ev => onVariantChange(idx, ev.target.value)}>
                          {e.variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {e.saved ? (
                        <span className="text-muted">{e.units.find(u => String(u.id) === e.unitId)?.abbreviation ?? '—'}</span>
                      ) : (
                        <select value={e.unitId} onChange={ev => onUnitChange(idx, ev.target.value)}>
                          {allUnits.map(u => <option key={u.id} value={u.id}>{u.abbreviation}</option>)}
                        </select>
                      )}
                    </td>
                    <td>
                      {e.saved ? (
                        <span style={{ fontWeight: 700 }}>{e.qty}</span>
                      ) : (
                        <input
                          type="number" step="any" min="0.001" value={e.qty}
                          placeholder="0"
                          onChange={ev => patchEntry(idx, { qty: ev.target.value })}
                          style={{ width: '80px' }}
                        />
                      )}
                    </td>
                    <td>
                      {e.saved ? (
                        <span className="text-muted">{e.price || '—'}</span>
                      ) : (
                        <input
                          type="number" step="0.01" min="0" value={e.price}
                          placeholder={e.originalPrice ? `curr: ${e.originalPrice}` : 'optional'}
                          onChange={ev => patchEntry(idx, { price: ev.target.value })}
                          style={{ width: '90px' }}
                        />
                      )}
                    </td>
                    <td>
                      {e.saved ? (
                        <span className="text-muted">{e.notes || '—'}</span>
                      ) : (
                        <input
                          type="text" value={e.notes}
                          placeholder="optional"
                          onChange={ev => patchEntry(idx, { notes: ev.target.value })}
                        />
                      )}
                    </td>
                    <td>
                      {e.saved ? (
                        <span style={{ color: '#15803d', fontSize: '1rem' }}>✓</span>
                      ) : (
                        <button className="btn-icon-danger" onClick={() => removeRow(idx)} title="Remove row">
                          <X size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-actions" style={{ marginTop: '0.75rem' }}>
            <button className="btn-primary" onClick={saveAll} disabled={savingAll || entries.length === 0}>
              {savingAll ? t('common.saving') : `Save ${entries.filter(e => !e.saved).length} ${entries.filter(e => !e.saved).length === 1 ? 'Entry' : 'Entries'}`}
            </button>
            <button className="btn-ghost btn-sm" onClick={addRow}>
              <Plus size={13} /> Add Row
            </button>
          </div>
        </div>
      )}

      {/* ── Stock table ───────────────────────────────────────── */}
      <div className="catalog-filters">
        <input
          type="text"
          placeholder={t('common.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>{t('stock.item')}</th>
            <th>{t('stock.variant')}</th>
            <th style={{ textAlign: 'right' }}>{t('stock.balance')}</th>
            <th style={{ width: 80 }}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-state">
                {stockLevels.length === 0 ? t('stock.none') : t('common.no_data')}
              </td>
            </tr>
          )}
          {filtered.map((s, i) => {
            const key = stockRowKey(s)
            const isEditing = editKey === key
            return (
              <tr key={i} style={{ background: isEditing ? 'var(--bg-subtle)' : undefined }}>
                <td>{s.item_name}</td>
                <td>
                  {s.variant_name && s.variant_name !== s.item_name
                    ? s.variant_name
                    : <span style={{ color: '#4b5563' }}>—</span>}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                      <input
                        type="number" step="any" min="0"
                        value={editQty}
                        onChange={e => setEditQty(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(s); if (e.key === 'Escape') cancelEdit() }}
                        style={{ width: 90, textAlign: 'right' }}
                        autoFocus
                      />
                      <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{s.unit_abbreviation}</span>
                    </div>
                  ) : (
                    <>
                      <span className={s.balance <= 0 ? 'stock-zero' : 'stock-positive'}>
                        {Number(s.balance).toLocaleString('en-NP', { maximumFractionDigits: 3 })}
                      </span>
                      {' '}
                      <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{s.unit_abbreviation}</span>
                    </>
                  )}
                  {isEditing && editError && (
                    <div className="form-error" style={{ fontSize: '0.7rem', marginTop: '0.15rem' }}>{editError}</div>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                      <button
                        className="btn-icon"
                        title="Save"
                        onClick={() => saveEdit(s)}
                        disabled={editSaving}
                        style={{ color: '#15803d' }}
                      >
                        <Check size={14} />
                      </button>
                      <button className="btn-icon" title="Cancel" onClick={cancelEdit}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-icon"
                      title="Edit stock"
                      onClick={() => startEdit(s)}
                      style={{ opacity: 0.5 }}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { AuthUser, ItemRow, VariantRow, UnitRow, StockLevel } from '../../../shared/types/api'

interface Props {
  currentUser: AuthUser
}

interface OpeningForm {
  itemId: string
  variantId: string
  unitId: string
  qty: string
  notes: string
}

const EMPTY_FORM: OpeningForm = {
  itemId: '',
  variantId: '',
  unitId: '',
  qty: '',
  notes: '',
}

export default function StockPage({ currentUser }: Props) {
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [units, setUnits] = useState<UnitRow[]>([])
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [search, setSearch] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<OpeningForm>(EMPTY_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadStock() {
    const res = await window.api.inventory.getAll()
    if (res.ok && res.data) setStockLevels(res.data)
  }

  async function loadUnits() {
    const res = await window.api.units.getAll()
    if (res.ok && res.data) {
      setUnits(res.data)
      const def = res.data.find(u => u.is_default)
      if (def) setForm(f => ({ ...f, unitId: String(def.id) }))
    }
  }

  useEffect(() => {
    loadStock()
    loadUnits()
    window.api.items.getAll().then(r => { if (r.ok && r.data) setItems(r.data) })
  }, [])

  async function onItemChange(itemId: string) {
    setForm(f => ({ ...f, itemId, variantId: '' }))
    setVariants([])
    if (!itemId) return
    const res = await window.api.variants.getByItem(parseInt(itemId))
    if (res.ok && res.data) {
      const active = res.data.filter(v => v.is_active)
      setVariants(active)
      const def = active.find(v => v.is_default) ?? active[0]
      const item = items.find(i => i.id === parseInt(itemId))
      setForm(f => ({
        ...f,
        itemId,
        variantId: def ? String(def.id) : '',
        unitId: item ? String(item.default_unit_id) : f.unitId,
      }))
    }
  }

  function openForm() {
    const defUnit = units.find(u => u.is_default) ?? units[0]
    setForm({ ...EMPTY_FORM, unitId: defUnit ? String(defUnit.id) : '' })
    setVariants([])
    setError('')
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setForm(EMPTY_FORM)
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const qty = parseFloat(form.qty)
    if (isNaN(qty) || qty <= 0) { setError('Quantity must be greater than zero'); return }
    const itemId = parseInt(form.itemId)
    const unitId = parseInt(form.unitId)
    const variantId = form.variantId ? parseInt(form.variantId) : null
    if (!itemId) { setError('Select an item'); return }
    if (!unitId) { setError('Select a unit'); return }

    const item = items.find(i => i.id === itemId)
    if (!item) { setError('Item not found'); return }

    setSaving(true)
    try {
      const res = await window.api.inventory.addOpening(
        itemId,
        variantId,
        unitId,
        qty,
        item.category,
        currentUser.id,
        form.notes || undefined
      )
      if (!res.ok) { setError(res.error ?? 'Unknown error'); return }
      cancel()
      loadStock()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IPC error — restart the app')
    } finally {
      setSaving(false)
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
        <h2>Stock</h2>
        <button className="btn-primary" onClick={openForm}>+ Opening Stock</button>
      </div>

      {showForm && (
        <div className="inline-form">
          <h3>Enter Opening Stock</h3>
          {error && <p className="form-error">{error}</p>}
          <form onSubmit={submit}>
            <div className="form-row">
              <label>
                Item
                <select
                  value={form.itemId}
                  onChange={e => onItemChange(e.target.value)}
                  required
                  autoFocus
                >
                  <option value="">— select item —</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </label>

              {variants.length > 1 && (
                <label>
                  Variant
                  <select
                    value={form.variantId}
                    onChange={e => setForm(f => ({ ...f, variantId: e.target.value }))}
                  >
                    {variants.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                Quantity
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  value={form.qty}
                  onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                  placeholder="0"
                  required
                />
              </label>

              <label>
                Unit
                <select
                  value={form.unitId}
                  onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))}
                  required
                >
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                  ))}
                </select>
              </label>

              <label>
                Notes <span style={{ color: '#6b7280', fontWeight: 400 }}>(optional)</span>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. counted on opening day"
                />
              </label>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Record Stock'}
              </button>
              <button type="button" className="btn-ghost" onClick={cancel}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="catalog-filters">
        <input
          type="text"
          placeholder="Search stock…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Variant</th>
            <th>Category</th>
            <th style={{ textAlign: 'right' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-state">
                {stockLevels.length === 0
                  ? 'No stock recorded yet — add opening stock to get started'
                  : 'No results'}
              </td>
            </tr>
          )}
          {filtered.map((s, i) => (
            <tr key={i}>
              <td>{s.item_name}</td>
              <td>{s.variant_name ?? <span style={{ color: '#4b5563' }}>—</span>}</td>
              <td>
                <span className={`badge badge-${s.item_category}`}>
                  {s.item_category.replace('_', ' ')}
                </span>
              </td>
              <td style={{ textAlign: 'right' }}>
                <span className={s.balance <= 0 ? 'stock-zero' : 'stock-positive'}>
                  {Number(s.balance).toLocaleString('en-NP', { maximumFractionDigits: 3 })}
                </span>
                {' '}
                <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{s.unit_abbreviation}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

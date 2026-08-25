import { useEffect, useState } from 'react'
import type { ItemRow, VariantRow, UnitRow, CurrentPrice } from '../../../shared/types/api'

type PriceType = 'sell' | 'buy'

interface SetPriceForm {
  variantId: string
  unitId: string
  price: string
  priceType: PriceType
  effectiveFrom: string
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function PricesPage() {
  const [items, setItems] = useState<ItemRow[]>([])
  const [selectedItem, setSelectedItem] = useState<ItemRow | null>(null)
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [units, setUnits] = useState<UnitRow[]>([])
  const [currentPrices, setCurrentPrices] = useState<CurrentPrice[]>([])
  const [search, setSearch] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SetPriceForm>({
    variantId: '',
    unitId: '',
    price: '',
    priceType: 'sell',
    effectiveFrom: today(),
  })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.units.getAll().then(r => {
      if (r.ok && r.data) {
        setUnits(r.data)
        const def = r.data.find(u => u.is_default)
        if (def) setForm(f => ({ ...f, unitId: String(def.id) }))
      }
    })
  }, [])

  useEffect(() => {
    window.api.items.search(search).then(r => { if (r.ok && r.data) setItems(r.data) })
  }, [search])

  async function selectItem(item: ItemRow) {
    setSelectedItem(item)
    setShowForm(false)
    const [vRes, pRes] = await Promise.all([
      window.api.variants.getByItem(item.id),
      window.api.prices.getCurrent(item.id),
    ])
    const activeVariants = (vRes.data ?? []).filter(v => v.is_active)
    setVariants(activeVariants)
    setCurrentPrices(pRes.data ?? [])
    setForm(f => ({
      ...f,
      variantId: activeVariants.find(v => v.is_default)?.id
        ? String(activeVariants.find(v => v.is_default)!.id)
        : activeVariants[0]?.id ? String(activeVariants[0].id) : '',
      unitId: String(item.default_unit_id),
    }))
  }

  function openForm(priceType: PriceType, variantId?: number) {
    setFormError('')
    setForm(f => ({
      ...f,
      priceType,
      variantId: variantId ? String(variantId) : f.variantId,
      price: '',
      effectiveFrom: today(),
    }))
    setShowForm(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedItem) return
    setFormError('')
    const price = parseFloat(form.price)
    if (isNaN(price) || price < 0) { setFormError('Enter a valid price (0 or above)'); return }
    const unitId = parseInt(form.unitId)
    if (!unitId) { setFormError('Select a unit'); return }
    const variantId = form.variantId ? parseInt(form.variantId) : null
    setSaving(true)
    try {
      const res = await window.api.prices.set(
        selectedItem.id,
        variantId,
        unitId,
        price,
        form.priceType,
        form.effectiveFrom
      )
      if (!res.ok) { setFormError(res.error ?? 'Unknown error'); return }
      setShowForm(false)
      const pRes = await window.api.prices.getCurrent(selectedItem.id)
      setCurrentPrices(pRes.data ?? [])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setSaving(false)
    }
  }

  const sellPrices = currentPrices.filter(p => p.price_type === 'sell')
  const buyPrices = currentPrices.filter(p => p.price_type === 'buy')

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <h2>Prices</h2>
      </div>

      <div className="prices-layout">
        {/* ── Item picker ── */}
        <div className="item-picker">
          <input
            type="text"
            placeholder="Search items…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="search-input"
          />
          <ul className="item-list">
            {items.map(item => (
              <li
                key={item.id}
                className={`item-list-row${selectedItem?.id === item.id ? ' item-list-row-active' : ''}`}
                onClick={() => selectItem(item)}
              >
                <span>{item.name}</span>
                <span className={`badge badge-${item.category}`}>{item.category.replace('_', ' ')}</span>
              </li>
            ))}
            {items.length === 0 && <li className="empty-state">No items</li>}
          </ul>
        </div>

        {/* ── Price panel ── */}
        <div className="price-panel">
          {!selectedItem && (
            <p className="empty-state" style={{ marginTop: '3rem' }}>← Select an item to manage its prices</p>
          )}

          {selectedItem && (
            <>
              <div className="price-panel-header">
                <h3>{selectedItem.name}</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-primary btn-sm" onClick={() => openForm('sell')}>
                    + Sell Price
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => openForm('buy')}>
                    + Buy Price
                  </button>
                </div>
              </div>

              {showForm && (
                <div className="inline-form" style={{ marginBottom: '1rem' }}>
                  <h3>Set {form.priceType === 'sell' ? 'Selling' : 'Buying'} Price</h3>
                  {formError && <p className="form-error">{formError}</p>}
                  <form onSubmit={submit}>
                    <div className="form-row">
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
                        Unit
                        <select
                          value={form.unitId}
                          onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))}
                        >
                          {units.map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Price (Rs.)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.price}
                          onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                          placeholder="0.00"
                          required
                          autoFocus
                        />
                      </label>
                      <label>
                        Effective From
                        <input
                          type="date"
                          value={form.effectiveFrom}
                          onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                          required
                        />
                      </label>
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? 'Saving…' : 'Set Price'}
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="price-section">
                <div className="price-section-label">Selling Prices</div>
                <PriceTable
                  prices={sellPrices}
                  onUpdate={(variantId) => openForm('sell', variantId ?? undefined)}
                />
              </div>

              <div className="price-section">
                <div className="price-section-label">Buying / Purchase Prices</div>
                <PriceTable
                  prices={buyPrices}
                  onUpdate={(variantId) => openForm('buy', variantId ?? undefined)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PriceTable({
  prices,
  onUpdate,
}: {
  prices: CurrentPrice[]
  variants?: VariantRow[]
  onUpdate: (variantId: number | null) => void
}) {
  if (prices.length === 0) {
    return <p className="empty-state" style={{ padding: '0.75rem 0' }}>No price set</p>
  }
  return (
    <table className="data-table data-table-sm" style={{ marginBottom: '0.5rem' }}>
      <thead>
        <tr>
          <th>Variant</th>
          <th>Price</th>
          <th>Unit</th>
          <th>Since</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {prices.map(p => (
          <tr key={p.id}>
            <td>{p.variant_name ?? '—'}</td>
            <td><strong>Rs. {Number(p.price).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</strong></td>
            <td>/{p.unit_abbreviation}</td>
            <td style={{ color: '#6b7280', fontSize: '0.8rem' }}>{p.effective_from}</td>
            <td className="row-actions">
              <button
                className="btn-ghost btn-sm"
                onClick={() => onUpdate(p.variant_id)}
              >
                Update
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

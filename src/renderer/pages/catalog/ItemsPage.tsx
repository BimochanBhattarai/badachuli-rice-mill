import { useEffect, useState } from 'react'
import type { ItemRow, UnitRow, VariantRow } from '../../../shared/types/api'

const CATEGORIES: { value: ItemRow['category']; label: string }[] = [
  { value: 'raw_material', label: 'Raw Material' },
  { value: 'finished', label: 'Finished Good' },
  { value: 'byproduct', label: 'By-product' },
  { value: 'consumable', label: 'Consumable' },
]

interface ItemFormState {
  name: string
  category: ItemRow['category']
  defaultUnitId: string
}

interface VariantFormState {
  name: string
  isDefault: boolean
}

const EMPTY_ITEM: ItemFormState = { name: '', category: 'raw_material', defaultUnitId: '' }
const EMPTY_VARIANT: VariantFormState = { name: '', isDefault: false }

export default function ItemsPage() {
  const [items, setItems] = useState<ItemRow[]>([])
  const [units, setUnits] = useState<UnitRow[]>([])
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')

  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM)
  const [itemError, setItemError] = useState('')
  const [itemLoading, setItemLoading] = useState(false)

  const [expandedItemId, setExpandedItemId] = useState<number | null>(null)
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [showVariantForm, setShowVariantForm] = useState(false)
  const [editingVariantId, setEditingVariantId] = useState<number | null>(null)
  const [variantForm, setVariantForm] = useState<VariantFormState>(EMPTY_VARIANT)
  const [variantError, setVariantError] = useState('')

  async function loadItems() {
    const res = await window.api.items.search(search, filterCategory || undefined)
    if (res.ok && res.data) setItems(res.data)
  }

  async function loadUnits() {
    const res = await window.api.units.getAll()
    if (res.ok && res.data) {
      setUnits(res.data)
      const def = res.data.find(u => u.is_default)
      if (def) setItemForm(f => ({ ...f, defaultUnitId: String(def.id) }))
    }
  }

  useEffect(() => { loadUnits() }, [])
  useEffect(() => { loadItems() }, [search, filterCategory])

  async function loadVariants(itemId: number) {
    const res = await window.api.variants.getByItem(itemId)
    if (res.ok && res.data) setVariants(res.data)
  }

  function toggleExpand(itemId: number) {
    if (expandedItemId === itemId) {
      setExpandedItemId(null)
      setShowVariantForm(false)
    } else {
      setExpandedItemId(itemId)
      setShowVariantForm(false)
      loadVariants(itemId)
    }
  }

  // ── Item form ───────────────────────────────────────────────

  function openCreateItem() {
    setEditingItemId(null)
    const defaultUnit = units.find(u => u.is_default) ?? units[0]
    setItemForm({ ...EMPTY_ITEM, defaultUnitId: defaultUnit?.id ? String(defaultUnit.id) : '' })
    setItemError('')
    setShowItemForm(true)
  }

  function openEditItem(item: ItemRow) {
    setEditingItemId(item.id)
    setItemForm({
      name: item.name,
      category: item.category,
      defaultUnitId: String(item.default_unit_id),
    })
    setItemError('')
    setShowItemForm(true)
  }

  function cancelItem() {
    setShowItemForm(false)
    setEditingItemId(null)
    setItemForm(EMPTY_ITEM)
    setItemError('')
  }

  async function submitItem(e: React.FormEvent) {
    e.preventDefault()
    setItemError('')
    const unitId = parseInt(itemForm.defaultUnitId)
    if (!unitId) { setItemError('Please select a default unit'); return }
    setItemLoading(true)
    try {
      const res =
        editingItemId !== null
          ? await window.api.items.update(editingItemId, itemForm.name, itemForm.category, unitId)
          : await window.api.items.create(itemForm.name, itemForm.category, unitId)
      if (!res.ok) { setItemError(res.error ?? 'Unknown error'); return }
      cancelItem()
      loadItems()
    } catch (err) {
      setItemError(err instanceof Error ? err.message : 'IPC error — try restarting the app')
    } finally {
      setItemLoading(false)
    }
  }

  async function handleDeactivateItem(id: number) {
    if (!confirm('Archive this item? It will no longer appear in billing.')) return
    try {
      const res = await window.api.items.deactivate(id)
      if (!res.ok) { alert(res.error); return }
      loadItems()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'IPC error')
    }
  }

  // ── Variant form ───────────────────────────────────────────

  function openCreateVariant() {
    setEditingVariantId(null)
    setVariantForm(EMPTY_VARIANT)
    setVariantError('')
    setShowVariantForm(true)
  }

  function openEditVariant(v: VariantRow) {
    setEditingVariantId(v.id)
    setVariantForm({ name: v.name, isDefault: v.is_default === 1 })
    setVariantError('')
    setShowVariantForm(true)
  }

  function cancelVariant() {
    setShowVariantForm(false)
    setEditingVariantId(null)
    setVariantForm(EMPTY_VARIANT)
    setVariantError('')
  }

  async function submitVariant(e: React.FormEvent) {
    e.preventDefault()
    setVariantError('')
    if (!expandedItemId) return
    try {
      const res =
        editingVariantId !== null
          ? await window.api.variants.update(editingVariantId, variantForm.name, variantForm.isDefault)
          : await window.api.variants.create(expandedItemId, variantForm.name, variantForm.isDefault)
      if (!res.ok) { setVariantError(res.error ?? 'Unknown error'); return }
      cancelVariant()
      loadVariants(expandedItemId)
    } catch (err) {
      setVariantError(err instanceof Error ? err.message : 'IPC error')
    }
  }

  async function handleDeactivateVariant(v: VariantRow) {
    if (v.is_default && variants.filter(x => x.is_active).length <= 1) {
      alert('Cannot remove the only active variant.')
      return
    }
    try {
      const res = await window.api.variants.deactivate(v.id)
      if (!res.ok) { alert(res.error); return }
      loadVariants(v.item_id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'IPC error')
    }
  }

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <h2>Items</h2>
        <button className="btn-primary" onClick={openCreateItem}>+ Add Item</button>
      </div>

      <div className="catalog-filters">
        <input
          type="text"
          placeholder="Search items…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {showItemForm && (
        <div className="inline-form">
          <h3>{editingItemId !== null ? 'Edit Item' : 'New Item'}</h3>
          {itemError && <p className="form-error">{itemError}</p>}
          <form onSubmit={submitItem}>
            <div className="form-row">
              <label>
                Name
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Dhan (Paddy)"
                  required
                  autoFocus
                />
              </label>
              <label>
                Category
                <select
                  value={itemForm.category}
                  onChange={e => setItemForm(f => ({ ...f, category: e.target.value as ItemRow['category'] }))}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Default Unit
                <select
                  value={itemForm.defaultUnitId}
                  onChange={e => setItemForm(f => ({ ...f, defaultUnitId: e.target.value }))}
                  required
                >
                  <option value="">— select —</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={itemLoading}>
                {itemLoading ? 'Saving…' : editingItemId !== null ? 'Update' : 'Create'}
              </button>
              <button type="button" className="btn-ghost" onClick={cancelItem}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Default Unit</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={4} className="empty-state">No items found</td></tr>
          )}
          {items.map(item => (
            <>
              <tr key={item.id} className={expandedItemId === item.id ? 'row-expanded' : ''}>
                <td>
                  <button className="btn-link" onClick={() => toggleExpand(item.id)}>
                    {expandedItemId === item.id ? '▾' : '▸'} {item.name}
                  </button>
                </td>
                <td><span className={`badge badge-${item.category}`}>{item.category.replace('_', ' ')}</span></td>
                <td>{item.unit_name} ({item.unit_abbreviation})</td>
                <td className="row-actions">
                  <button className="btn-ghost btn-sm" onClick={() => openEditItem(item)}>Edit</button>
                  <button className="btn-danger btn-sm" onClick={() => handleDeactivateItem(item.id)}>Archive</button>
                </td>
              </tr>

              {expandedItemId === item.id && (
                <tr key={`variants-${item.id}`} className="variant-row">
                  <td colSpan={4}>
                    <div className="variant-panel">
                      <div className="variant-panel-header">
                        <span>Variants</span>
                        <button className="btn-ghost btn-sm" onClick={openCreateVariant}>+ Add Variant</button>
                      </div>

                      {showVariantForm && (
                        <div className="inline-form inline-form-sm">
                          {variantError && <p className="form-error">{variantError}</p>}
                          <form onSubmit={submitVariant}>
                            <div className="form-row">
                              <label>
                                Variant Name
                                <input
                                  type="text"
                                  value={variantForm.name}
                                  onChange={e => setVariantForm(f => ({ ...f, name: e.target.value }))}
                                  placeholder="e.g. Mansuli"
                                  required
                                  autoFocus
                                />
                              </label>
                              <label className="label-checkbox">
                                <input
                                  type="checkbox"
                                  checked={variantForm.isDefault}
                                  onChange={e => setVariantForm(f => ({ ...f, isDefault: e.target.checked }))}
                                />
                                Default variant
                              </label>
                            </div>
                            <div className="form-actions">
                              <button type="submit" className="btn-primary btn-sm">
                                {editingVariantId !== null ? 'Update' : 'Add'}
                              </button>
                              <button type="button" className="btn-ghost btn-sm" onClick={cancelVariant}>Cancel</button>
                            </div>
                          </form>
                        </div>
                      )}

                      <table className="data-table data-table-sm">
                        <thead>
                          <tr><th>Name</th><th>Default</th><th></th></tr>
                        </thead>
                        <tbody>
                          {variants.filter(v => v.is_active).map(v => (
                            <tr key={v.id}>
                              <td>{v.name}</td>
                              <td>{v.is_default ? '✓' : ''}</td>
                              <td className="row-actions">
                                <button className="btn-ghost btn-sm" onClick={() => openEditVariant(v)}>Edit</button>
                                <button className="btn-danger btn-sm" onClick={() => handleDeactivateVariant(v)}>Remove</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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

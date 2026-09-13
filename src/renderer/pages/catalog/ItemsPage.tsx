import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { ItemRow, UnitRow, VariantRow } from '../../../shared/types/api'
import { useLanguage } from '../../i18n'

// ── Tab config ─────────────────────────────────────────────
type Tab = 'buying' | 'processing' | 'selling'

const TAB_LABELS: Record<Tab, string> = {
  buying:     'Buying Items',
  processing: 'Processing Items',
  selling:    'Selling Items',
}

const SEARCH_FILTER: Record<Tab, { buyable?: boolean; sellable?: boolean; processable?: boolean }> = {
  buying:     { buyable: true },
  processing: { processable: true },
  selling:    { sellable: true },
}

const PURPOSE_FLAGS: Record<Tab, { isBuyable: boolean; isSellable: boolean; isProcessable: boolean }> = {
  buying:     { isBuyable: true,  isSellable: false, isProcessable: false },
  processing: { isBuyable: false, isSellable: false, isProcessable: true  },
  selling:    { isBuyable: false, isSellable: true,  isProcessable: false },
}

const PRICE_LABEL: Record<Tab, string | null> = {
  buying:     null,
  processing: 'Processing Charge (Rs.)',
  selling:    'Sell Price (Rs.)',
}

const PRICE_TYPE: Record<Tab, 'sell' | 'processing' | null> = {
  buying:     null,
  processing: 'processing',
  selling:    'sell',
}

// ── Types ──────────────────────────────────────────────────
interface VariantDraft {
  key: string
  name: string
  price: string
}

interface ItemFormState {
  name: string
  defaultUnitId: string
  hasVariants: boolean
  price: string
  variants: VariantDraft[]
}

const newVariant = (): VariantDraft => ({
  key: String(Date.now() + Math.random()),
  name: '',
  price: '',
})

const EMPTY_FORM: ItemFormState = {
  name: '',
  defaultUnitId: '',
  hasVariants: false,
  price: '',
  variants: [newVariant()],
}

function purposeLabel(item: ItemRow): string {
  const tags: string[] = []
  if (item.is_buyable)     tags.push('Buy')
  if (item.is_sellable)    tags.push('Sell')
  if (item.is_processable) tags.push('Process')
  return tags.join(' · ') || '—'
}

function today() { return new Date().toISOString().slice(0, 10) }

// ── Component ──────────────────────────────────────────────
export default function ItemsPage() {
  const { t } = useLanguage()

  const [tab, setTab] = useState<Tab>('buying')
  const [items, setItems] = useState<ItemRow[]>([])
  const [units, setUnits] = useState<UnitRow[]>([])
  const [search, setSearch] = useState('')

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [form, setForm] = useState<ItemFormState>(EMPTY_FORM)
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  // Edit modal
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null)
  const [editForm, setEditForm] = useState({ name: '', defaultUnitId: '', isBuyable: false, isSellable: false, isProcessable: false })
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Variant expand panel
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null)
  const [expandedVariants, setExpandedVariants] = useState<VariantRow[]>([])
  const [variantEditId, setVariantEditId] = useState<number | null>(null)
  const [variantEditName, setVariantEditName] = useState('')
  const [variantCreateName, setVariantCreateName] = useState('')
  const [variantError, setVariantError] = useState('')

  async function loadItems() {
    const res = await window.api.items.search(search, SEARCH_FILTER[tab])
    if (res.ok && res.data) setItems(res.data)
  }

  async function loadUnits() {
    const res = await window.api.units.getAll()
    if (res.ok && res.data) {
      setUnits(res.data)
      const def = res.data.find(u => u.is_default)
      if (def) setForm(f => ({ ...f, defaultUnitId: String(def.id) }))
    }
  }

  useEffect(() => { loadUnits() }, [])
  useEffect(() => { loadItems() }, [search, tab])

  // ── Tab switch ─────────────────────────────────────────────
  function switchTab(next: Tab) {
    setTab(next)
    setShowCreateForm(false)
    setSearch('')
    setExpandedItemId(null)
    setExpandedVariants([])
    setCreateError('')
  }

  // ── Create form ────────────────────────────────────────────
  function openCreate() {
    const defUnit = units.find(u => u.is_default) ?? units[0]
    setForm({ ...EMPTY_FORM, defaultUnitId: defUnit ? String(defUnit.id) : '', variants: [newVariant()] })
    setCreateError('')
    setShowCreateForm(true)
  }

  function setField<K extends keyof ItemFormState>(key: K, value: ItemFormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function updateVariantDraft(key: string, patch: Partial<VariantDraft>) {
    setForm(f => ({ ...f, variants: f.variants.map(v => v.key === key ? { ...v, ...patch } : v) }))
  }

  async function submitCreate() {
    setCreateError('')
    const unitId = parseInt(form.defaultUnitId)
    if (!form.name.trim())  { setCreateError('Item name is required'); return }
    if (!unitId)            { setCreateError('Select a unit'); return }
    if (form.hasVariants && form.variants.some(v => !v.name.trim())) {
      setCreateError('All variant names are required'); return
    }
    setCreateLoading(true)
    const { isBuyable, isSellable, isProcessable } = PURPOSE_FLAGS[tab]
    const priceType = PRICE_TYPE[tab]
    const dt = today()
    try {
      const res = await window.api.items.create(form.name.trim(), unitId, isBuyable, isSellable, isProcessable)
      if (!res.ok || !res.data) { setCreateError(res.error ?? 'Create failed'); return }
      const { id: itemId, variantId: defaultVariantId } = res.data

      if (!form.hasVariants) {
        if (priceType && form.price && parseFloat(form.price) >= 0) {
          await window.api.prices.set(itemId, defaultVariantId, unitId, parseFloat(form.price), priceType, dt)
        }
      } else {
        const first = form.variants[0]
        if (first.name.trim() && first.name.trim() !== form.name.trim()) {
          await window.api.variants.update(defaultVariantId, first.name.trim(), true)
        }
        if (priceType && first.price && parseFloat(first.price) >= 0) {
          await window.api.prices.set(itemId, defaultVariantId, unitId, parseFloat(first.price), priceType, dt)
        }
        for (let i = 1; i < form.variants.length; i++) {
          const vf = form.variants[i]
          if (!vf.name.trim()) continue
          const vRes = await window.api.variants.create(itemId, vf.name.trim(), false)
          if (vRes.ok && vRes.data && priceType && vf.price && parseFloat(vf.price) >= 0) {
            await window.api.prices.set(itemId, vRes.data.id, unitId, parseFloat(vf.price), priceType, dt)
          }
        }
      }
      setShowCreateForm(false)
      loadItems()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setCreateLoading(false)
    }
  }

  // ── Edit ───────────────────────────────────────────────────
  function openEdit(item: ItemRow) {
    setEditingItem(item)
    setEditForm({
      name: item.name,
      defaultUnitId: String(item.default_unit_id),
      isBuyable:     !!item.is_buyable,
      isSellable:    !!item.is_sellable,
      isProcessable: !!item.is_processable,
    })
    setEditError('')
  }

  async function submitEdit() {
    if (!editingItem) return
    setEditError('')
    const unitId = parseInt(editForm.defaultUnitId)
    if (!editForm.name.trim()) { setEditError('Name is required'); return }
    if (!editForm.isBuyable && !editForm.isSellable && !editForm.isProcessable) {
      setEditError('Select at least one purpose'); return
    }
    setEditLoading(true)
    try {
      const res = await window.api.items.update(
        editingItem.id, editForm.name.trim(), unitId,
        editForm.isBuyable, editForm.isSellable, editForm.isProcessable
      )
      if (!res.ok) { setEditError(res.error ?? 'Update failed'); return }
      setEditingItem(null)
      loadItems()
    } finally {
      setEditLoading(false)
    }
  }

  // ── Variant expand ─────────────────────────────────────────
  async function loadExpandedVariants(itemId: number) {
    const res = await window.api.variants.getByItem(itemId)
    if (res.ok && res.data) setExpandedVariants(res.data.filter(v => v.is_active))
  }

  function toggleExpand(itemId: number) {
    if (expandedItemId === itemId) {
      setExpandedItemId(null); setExpandedVariants([])
    } else {
      setExpandedItemId(itemId)
      setVariantEditId(null); setVariantCreateName(''); setVariantError('')
      loadExpandedVariants(itemId)
    }
  }

  async function submitVariantCreate(itemId: number) {
    setVariantError('')
    if (!variantCreateName.trim()) { setVariantError('Name is required'); return }
    const res = await window.api.variants.create(itemId, variantCreateName.trim(), false)
    if (!res.ok) { setVariantError(res.error ?? 'Error'); return }
    setVariantCreateName('')
    loadExpandedVariants(itemId)
  }

  async function submitVariantEdit(variantId: number, itemId: number) {
    setVariantError('')
    if (!variantEditName.trim()) { setVariantError('Name is required'); return }
    const v = expandedVariants.find(vv => vv.id === variantId)
    const res = await window.api.variants.update(variantId, variantEditName.trim(), !!v?.is_default)
    if (!res.ok) { setVariantError(res.error ?? 'Error'); return }
    setVariantEditId(null)
    loadExpandedVariants(itemId)
  }

  async function deactivateVariant(v: VariantRow) {
    if (expandedVariants.length <= 1) { setVariantError('Cannot remove the only variant'); return }
    const res = await window.api.variants.deactivate(v.id)
    if (!res.ok) { setVariantError(res.error ?? 'Error'); return }
    loadExpandedVariants(v.item_id)
  }

  async function deactivateItem(id: number) {
    if (!confirm('Archive this item? It will no longer appear in billing.')) return
    const res = await window.api.items.deactivate(id)
    if (!res.ok) { alert(res.error); return }
    loadItems()
  }

  const priceLabel = PRICE_LABEL[tab]

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <h2>{t('items.title')}</h2>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div className="price-tabs">
          {(['buying', 'processing', 'selling'] as Tab[]).map(tabKey => (
            <button
              key={tabKey}
              className={`price-tab-btn${tab === tabKey ? ' price-tab-active' : ''}`}
              onClick={() => switchTab(tabKey)}
            >
              {TAB_LABELS[tabKey]}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Create Item</button>
      </div>

      {/* ── Search ── */}
      <div className="catalog-filters">
        <input
          type="text"
          placeholder={t('common.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* ── Create Form ── */}
      {showCreateForm && (
        <div className="item-create-form">
          <div className="item-create-form-header">
            <span>New {TAB_LABELS[tab].replace(' Items', ' Item')}</span>
            <button className="btn-ghost btn-sm" onClick={() => setShowCreateForm(false)}>✕ {t('common.cancel')}</button>
          </div>

          {createError && <div className="form-error" style={{ marginBottom: '0.75rem' }}>{createError}</div>}

          {/* Name + Unit */}
          <div className="form-row" style={{ marginBottom: '0.75rem' }}>
            <label>
              {t('common.name')}
              <input
                type="text"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="e.g. Makai, Dhan, Chamal…"
                autoFocus
              />
            </label>
            <label>
              {t('items.default_unit')}
              <select value={form.defaultUnitId} onChange={e => setField('defaultUnitId', e.target.value)}>
                <option value="">— select —</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                ))}
              </select>
            </label>
          </div>

          {/* Variants toggle */}
          <div className="item-variants-toggle">
            <span className="item-variants-toggle-label">Variants:</span>
            <div className="pay-toggle">
              <button
                type="button"
                className={`pay-toggle-btn${!form.hasVariants ? ' pay-toggle-active' : ''}`}
                onClick={() => setField('hasVariants', false)}
              >
                Single item
              </button>
              <button
                type="button"
                className={`pay-toggle-btn${form.hasVariants ? ' pay-toggle-active' : ''}`}
                onClick={() => setField('hasVariants', true)}
              >
                Has variants
              </button>
            </div>
          </div>

          {/* Single item price */}
          {!form.hasVariants && priceLabel && (
            <div className="item-price-section">
              <div className="item-price-section-label">Initial Price</div>
              <div className="item-price-row">
                <label>
                  {priceLabel}
                  <input
                    type="number" step="0.01" min="0"
                    placeholder="0.00"
                    value={form.price}
                    onChange={e => setField('price', e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Variant list with prices */}
          {form.hasVariants && (
            <div className="item-price-section">
              <div className="item-price-section-label">
                Variants{priceLabel ? ' & Prices' : ''}
                <span className="text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                  First variant is the default
                </span>
              </div>

              <div className="item-variants-header">
                <span style={{ flex: 2 }}>Variant Name</span>
                {priceLabel && <span style={{ flex: 1 }}>{priceLabel}</span>}
                <span style={{ width: 28 }}></span>
              </div>

              {form.variants.map((v, idx) => (
                <div key={v.key} className="item-variants-row">
                  <input
                    type="text"
                    className="bill-input"
                    style={{ flex: 2 }}
                    placeholder={`Variant ${idx + 1} name`}
                    value={v.name}
                    onChange={e => updateVariantDraft(v.key, { name: e.target.value })}
                  />
                  {priceLabel && (
                    <input
                      type="number" step="0.01" min="0"
                      className="bill-input"
                      style={{ flex: 1 }}
                      placeholder="0.00"
                      value={v.price}
                      onChange={e => updateVariantDraft(v.key, { price: e.target.value })}
                    />
                  )}
                  {form.variants.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      style={{ padding: '0.3rem', color: '#dc2626' }}
                      onClick={() => setForm(f => ({ ...f, variants: f.variants.filter(vv => vv.key !== v.key) }))}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="btn-ghost btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.25rem' }}
                onClick={() => setForm(f => ({ ...f, variants: [...f.variants, newVariant()] }))}
              >
                <Plus size={13} /> Add another variant
              </button>
            </div>
          )}

          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button className="btn-primary" onClick={submitCreate} disabled={createLoading}>
              {createLoading ? t('common.saving') : t('common.create')}
            </button>
            <button className="btn-ghost" onClick={() => setShowCreateForm(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editingItem && (
        <div className="confirm-overlay">
          <div className="confirm-modal" style={{ maxWidth: 460 }}>
            <div className="confirm-modal-header">
              <span>{t('items.edit')}</span>
            </div>
            <div className="form-row">
              <label>
                Name
                <input type="text" value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus />
              </label>
              <label>
                Unit
                <select value={editForm.defaultUnitId}
                  onChange={e => setEditForm(f => ({ ...f, defaultUnitId: e.target.value }))}>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="purpose-flags" style={{ marginBottom: 0 }}>
              <span className="purpose-flags-label">Can be:</span>
              <label className="label-checkbox">
                <input type="checkbox" checked={editForm.isBuyable}
                  onChange={e => setEditForm(f => ({ ...f, isBuyable: e.target.checked }))} />
                Bought
              </label>
              <label className="label-checkbox">
                <input type="checkbox" checked={editForm.isSellable}
                  onChange={e => setEditForm(f => ({ ...f, isSellable: e.target.checked }))} />
                Sold
              </label>
              <label className="label-checkbox">
                <input type="checkbox" checked={editForm.isProcessable}
                  onChange={e => setEditForm(f => ({ ...f, isProcessable: e.target.checked }))} />
                Processed
              </label>
            </div>
            {editError && <div className="form-error">{editError}</div>}
            <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>
              To update prices or manage variants, use the Prices tab or expand the item row.
            </p>
            <div className="confirm-actions">
              <button className="btn-primary" onClick={submitEdit} disabled={editLoading}>
                {editLoading ? t('common.saving') : t('common.save')}
              </button>
              <button className="btn-ghost" onClick={() => setEditingItem(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Items table ── */}
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('common.name')}</th>
            <th>{t('items.default_unit')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={3} className="empty-state">{t('items.none')}</td></tr>
          )}
          {items.map(item => (
            <>
              <tr key={item.id}>
                <td>
                  <button className="btn-link" onClick={() => toggleExpand(item.id)}>
                    {expandedItemId === item.id ? '▾' : '▸'} {item.name}
                  </button>
                </td>
                <td className="text-muted">{item.unit_name} ({item.unit_abbreviation})</td>
                <td className="row-actions">
                  <button className="btn-ghost btn-sm" onClick={() => openEdit(item)}>{t('common.edit')}</button>
                  <button className="btn-danger btn-sm" onClick={() => deactivateItem(item.id)}>{t('items.deactivate')}</button>
                </td>
              </tr>

              {expandedItemId === item.id && (
                <tr key={`variants-${item.id}`}>
                  <td colSpan={3} style={{ padding: 0 }}>
                    <div className="variant-panel">
                      <div className="variant-panel-header">
                        <span>{t('items.variants')}</span>
                        <button className="btn-ghost btn-sm" onClick={() => {
                          setVariantCreateName(''); setVariantError(''); setVariantEditId(null)
                        }}>
                          {t('items.add_variant')}
                        </button>
                      </div>

                      {variantError && <div className="form-error" style={{ marginBottom: '0.5rem' }}>{variantError}</div>}

                      <div className="item-variant-add-row" style={{ marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          className="bill-input"
                          placeholder="New variant name…"
                          value={variantCreateName}
                          onChange={e => setVariantCreateName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') submitVariantCreate(item.id) }}
                          style={{ flex: 1 }}
                        />
                        <button className="btn-primary btn-sm" onClick={() => submitVariantCreate(item.id)}>Add</button>
                      </div>

                      <table className="data-table data-table-sm">
                        <thead>
                          <tr><th>Name</th><th>Default</th><th></th></tr>
                        </thead>
                        <tbody>
                          {expandedVariants.length === 0 && (
                            <tr><td colSpan={3} className="empty-state">No variants</td></tr>
                          )}
                          {expandedVariants.map(v => (
                            <tr key={v.id}>
                              <td>
                                {variantEditId === v.id ? (
                                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <input
                                      type="text"
                                      className="bill-input"
                                      value={variantEditName}
                                      onChange={e => setVariantEditName(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') submitVariantEdit(v.id, item.id) }}
                                      autoFocus
                                      style={{ width: 140 }}
                                    />
                                    <button className="btn-primary btn-sm" onClick={() => submitVariantEdit(v.id, item.id)}>Save</button>
                                    <button className="btn-ghost btn-sm" onClick={() => setVariantEditId(null)}>✕</button>
                                  </div>
                                ) : v.name}
                              </td>
                              <td>{v.is_default ? '✓' : ''}</td>
                              <td className="row-actions">
                                <button className="btn-ghost btn-sm" onClick={() => {
                                  setVariantEditId(v.id); setVariantEditName(v.name); setVariantError('')
                                }}>Edit</button>
                                <button className="btn-danger btn-sm" onClick={() => deactivateVariant(v)}>Remove</button>
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

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Wheat } from 'lucide-react'
import type { AuthUser, ItemRow, VariantRow, UnitRow, BatchWithRule, AdHocBatchOutput, StockLevel, MillPreset } from '../../../shared/types/api'
import { useLanguage } from '../../i18n'

interface Props { currentUser: AuthUser }

interface InputCard {
  item: ItemRow
  variant: VariantRow | null
  stock: number
}

interface OutputRow {
  item: ItemRow
  variants: VariantRow[]
  units: UnitRow[]
  variantId: string
  unitId: string
  yieldPct: string
}

export default function MillProcessingPage({ currentUser }: Props) {
  const { t, fmtDate } = useLanguage()

  const [inputCards, setInputCards] = useState<InputCard[]>([])
  const [sellableItems, setSellableItems] = useState<ItemRow[]>([])

  const [inputItem, setInputItem] = useState<ItemRow | null>(null)
  const [inputVariants, setInputVariants] = useState<VariantRow[]>([])
  const [inputUnits, setInputUnits] = useState<UnitRow[]>([])
  const [inputVariantId, setInputVariantId] = useState('')
  const [inputUnitId, setInputUnitId] = useState('')
  const [inputQty, setInputQty] = useState('')

  const [outputs, setOutputs] = useState<OutputRow[]>([])

  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [batches, setBatches] = useState<BatchWithRule[]>([])

  const qtyRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadBatches()
    loadData()
  }, [])

  async function loadData() {
    const [itemsRes, sellRes, stockRes] = await Promise.all([
      window.api.items.search('', { buyable: true }),
      window.api.items.search('', { sellable: true }),
      window.api.inventory.getAll(),
    ])

    if (sellRes.ok && sellRes.data) setSellableItems(sellRes.data)

    const items = itemsRes.ok ? (itemsRes.data ?? []) : []
    const stockLevels: StockLevel[] = stockRes.ok ? (stockRes.data ?? []) : []

    // Build stock map keyed by "itemId-variantId" (0 for null variant)
    const stockMap: Record<string, number> = {}
    for (const s of stockLevels) {
      const key = `${s.item_id}-${s.variant_id ?? 0}`
      stockMap[key] = (stockMap[key] ?? 0) + s.balance
    }

    // Load variants for all buyable items in parallel
    const variantResults = await Promise.all(
      items.map(item => window.api.variants.getByItem(item.id))
    )

    const cards: InputCard[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const variants = (variantResults[i].data ?? []).filter((v: VariantRow) => v.is_active)
      if (variants.length <= 1) {
        const variant = variants[0] ?? null
        const key = `${item.id}-${variant?.id ?? 0}`
        cards.push({ item, variant, stock: stockMap[key] ?? 0 })
      } else {
        for (const variant of variants) {
          const key = `${item.id}-${variant.id}`
          cards.push({ item, variant, stock: stockMap[key] ?? 0 })
        }
      }
    }
    setInputCards(cards)
  }

  async function loadBatches() {
    const res = await window.api.processing.getRecentMillBatches(40)
    if (res.ok && res.data) setBatches(res.data)
  }

  async function selectCard(card: InputCard) {
    const sameCard = inputItem?.id === card.item.id &&
      inputVariantId === (card.variant ? String(card.variant.id) : '')
    if (sameCard) return

    setInputItem(card.item)
    setOutputs([])
    setInputQty('')
    setError('')

    const [vRes, uRes, presetRes] = await Promise.all([
      window.api.variants.getByItem(card.item.id),
      window.api.units.getAll(),
      window.api.processing.getPresetsForItem(card.item.id),
    ])
    const variants = (vRes.data ?? []).filter((v: VariantRow) => v.is_active)
    const units = uRes.data ?? []
    const defUnit = units.find((u: UnitRow) => u.id === card.item.default_unit_id) ?? units[0]

    setInputVariants(variants)
    setInputUnits(units)
    setInputVariantId(card.variant ? String(card.variant.id) : '')
    setInputUnitId(defUnit ? String(defUnit.id) : '')

    if (presetRes.ok && presetRes.data && presetRes.data.length > 0) {
      const presetRows = await buildPresetOutputRows(presetRes.data, units)
      setOutputs(presetRows)
    }

    setTimeout(() => qtyRef.current?.focus(), 80)
  }

  async function buildPresetOutputRows(presets: MillPreset[], allUnits: UnitRow[]): Promise<OutputRow[]> {
    const rows: OutputRow[] = []
    for (const p of presets) {
      const vRes = await window.api.variants.getByItem(p.output_item_id)
      const variants = (vRes.data ?? []).filter((v: VariantRow) => v.is_active)
      const defVariant = variants.find((v: VariantRow) => v.is_default) ?? variants[0]
      const unit = allUnits.find(u => u.id === p.output_unit_id) ?? allUnits[0]
      const fakeItem: ItemRow = {
        id: p.output_item_id,
        name: p.output_item_name,
        category: p.is_byproduct ? 'byproduct' : 'finished',
        default_unit_id: p.output_unit_id,
        is_active: 1, is_buyable: 0, is_sellable: 1, is_processable: 0,
        created_at: '',
        unit_name: unit?.name ?? '',
        unit_abbreviation: p.output_unit_abbreviation,
      }
      rows.push({
        item: fakeItem, variants, units: allUnits,
        variantId: defVariant ? String(defVariant.id) : '',
        unitId: String(p.output_unit_id),
        yieldPct: String(p.default_yield_pct),
      })
    }
    return rows
  }

  async function selectOutputItem(itemId: string) {
    if (!itemId) return
    const item = sellableItems.find(i => String(i.id) === itemId)
    if (!item) return
    const [vRes, uRes] = await Promise.all([
      window.api.variants.getByItem(item.id),
      window.api.units.getAll(),
    ])
    const variants = (vRes.data ?? []).filter((v: VariantRow) => v.is_active)
    const units = uRes.data ?? []
    const defVariant = variants.find((v: VariantRow) => v.is_default) ?? variants[0]
    const defUnit = units.find((u: UnitRow) => u.id === item.default_unit_id) ?? units[0]
    setOutputs(prev => [...prev, {
      item, variants, units,
      variantId: defVariant ? String(defVariant.id) : '',
      unitId: defUnit ? String(defUnit.id) : '',
      yieldPct: '',
    }])
  }

  function updateOutput(idx: number, patch: Partial<OutputRow>) {
    setOutputs(prev => prev.map((o, i) => i !== idx ? o : { ...o, ...patch }))
  }

  async function runBatch() {
    setError('')
    setSuccessMsg('')
    if (!inputItem) { setError('Select an input material'); return }
    const qty = parseFloat(inputQty)
    if (isNaN(qty) || qty <= 0) { setError('Input quantity must be greater than 0'); return }
    if (outputs.length === 0) { setError('Add at least one output'); return }
    const bad = outputs.find(o => {
      const pct = parseFloat(o.yieldPct)
      return isNaN(pct) || pct <= 0
    })
    if (bad) { setError('All outputs need a valid yield %'); return }

    const payload: AdHocBatchOutput[] = outputs.map(o => {
      const pct = parseFloat(o.yieldPct)
      const actualQty = parseFloat(((qty * pct) / 100).toFixed(4))
      return {
        outputItemId: o.item.id,
        outputVariantId: o.variantId ? parseInt(o.variantId) : null,
        outputUnitId: parseInt(o.unitId),
        yieldPct: pct,
        actualQty,
      }
    })

    setSaving(true)
    try {
      const res = await window.api.processing.runAdHocBatch({
        inputItemId: inputItem.id,
        inputVariantId: inputVariantId ? parseInt(inputVariantId) : null,
        inputUnitId: parseInt(inputUnitId),
        inputQty: qty,
        outputs: payload,
        notes: notes || undefined,
        operatorId: currentUser.id,
      })
      if (!res.ok) { setError(res.error ?? 'Error'); return }
      setSuccessMsg(t('mill.batch_done'))
      setInputItem(null)
      setInputVariants([])
      setInputUnits([])
      setInputVariantId('')
      setInputUnitId('')
      setInputQty('')
      setOutputs([])
      setNotes('')
      await loadData()
      loadBatches()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setSaving(false)
    }
  }

  const inputUnitAbbr = inputUnits.find(u => u.id === parseInt(inputUnitId))?.abbreviation ?? ''
  const selectedVariantName = inputVariants.find(v => String(v.id) === inputVariantId)?.name ?? ''

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <div>
          <h2 className="page-title">{t('mill.title')}</h2>
          <p className="page-subtitle">{t('mill.subtitle')}</p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {successMsg && <p className="success-msg">{successMsg}</p>}

      {/* ── Step 1: Variant picker ───────────────────────────── */}
      <div className="mill-step-label">
        <span className="mill-step-num">1</span>
        {t('mill.input_section')}
      </div>

      <div className="mill-item-grid">
        {inputCards.map(card => {
          const isSelected = inputItem?.id === card.item.id &&
            inputVariantId === (card.variant ? String(card.variant.id) : '')
          const showVariant = card.variant && card.variant.name !== card.item.name
          return (
            <button
              key={`${card.item.id}-${card.variant?.id ?? 0}`}
              className={`mill-item-card${isSelected ? ' mill-item-card-active' : ''}`}
              onClick={() => selectCard(card)}
            >
              <Wheat size={18} className="mill-item-icon" />
              <span className="mill-item-name">{card.item.name}</span>
              {showVariant && (
                <span className="mill-item-variant">{card.variant!.name}</span>
              )}
              <span className={`mill-item-stock${card.stock <= 0 ? ' mill-item-stock-empty' : ''}`}>
                {card.stock.toLocaleString('en-NP', { maximumFractionDigits: 1 })} {card.item.unit_abbreviation}
              </span>
            </button>
          )
        })}
        {inputCards.length === 0 && (
          <p className="text-muted" style={{ padding: '1rem' }}>No buyable items found. Add items with "Bought" enabled in the Catalog.</p>
        )}
      </div>

      {/* ── Step 2: Quantity (only when variant selected) ─────── */}
      {inputItem && (
        <>
          <div className="mill-step-label" style={{ marginTop: '1.5rem' }}>
            <span className="mill-step-num">2</span>
            Quantity to Process
          </div>

          <div className="mill-form-card">
            <div className="mill-input-row">
              <label className="mill-field">
                <span>
                  {inputItem.name}
                  {selectedVariantName && selectedVariantName !== inputItem.name && ` · ${selectedVariantName}`}
                  {inputUnitAbbr && ` (${inputUnitAbbr})`}
                </span>
                <input
                  ref={qtyRef}
                  type="number" step="any" min="0.001"
                  value={inputQty}
                  onChange={e => setInputQty(e.target.value)}
                  placeholder="e.g. 100"
                />
              </label>

              <label className="mill-field mill-field-sm">
                <span>{t('mill.input_unit')}</span>
                <select value={inputUnitId} onChange={e => setInputUnitId(e.target.value)}>
                  {inputUnits.map(u => <option key={u.id} value={u.id}>{u.abbreviation}</option>)}
                </select>
              </label>
            </div>

            {/* ── Step 3: Outputs ──────────────────────────────── */}
            <div className="mill-step-label" style={{ marginTop: '1.25rem', marginBottom: '0.75rem', borderTop: '1px solid #e7e0d8', paddingTop: '1.1rem' }}>
              <span className="mill-step-num">3</span>
              {t('mill.outputs_section')}
            </div>

            {outputs.length > 0 && (
              <table className="data-table mill-outputs-table">
                <thead>
                  <tr>
                    <th>{t('mill.output_item')}</th>
                    <th>{t('bill.variant')}</th>
                    <th>{t('mill.input_unit')}</th>
                    <th style={{ textAlign: 'center' }}>{t('mill.yield_pct')}</th>
                    <th style={{ textAlign: 'right' }}>{t('mill.expected')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {outputs.map((o, i) => {
                    const qty = parseFloat(inputQty)
                    const pct = parseFloat(o.yieldPct)
                    const expected = (!isNaN(qty) && !isNaN(pct)) ? (qty * pct / 100).toFixed(2) : '—'
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>
                          {o.item.name}
                          {o.item.category === 'byproduct' && (
                            <span className="badge badge-byproduct" style={{ marginLeft: '0.4rem', fontSize: '0.6rem' }}>उपज</span>
                          )}
                        </td>
                        <td>
                          {o.variants.length > 1 ? (
                            <select value={o.variantId} onChange={e => updateOutput(i, { variantId: e.target.value })}>
                              {o.variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                          ) : (
                            <span className="text-muted">{o.variants[0]?.name ?? '—'}</span>
                          )}
                        </td>
                        <td>
                          <select value={o.unitId} onChange={e => updateOutput(i, { unitId: e.target.value })}>
                            {o.units.map(u => <option key={u.id} value={u.id}>{u.abbreviation}</option>)}
                          </select>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number" step="0.01" min="0.01" max="100"
                            value={o.yieldPct} placeholder="%"
                            className="mill-pct-input"
                            onChange={e => updateOutput(i, { yieldPct: e.target.value })}
                          />
                        </td>
                        <td className="text-muted" style={{ textAlign: 'right', fontWeight: 500 }}>
                          {expected}
                        </td>
                        <td>
                          <button className="btn-icon-danger" onClick={() => setOutputs(prev => prev.filter((_, j) => j !== i))}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {/* Add output — dropdown */}
            <div className="mill-add-output-row">
              <Plus size={14} style={{ color: '#6b7280' }} />
              <select
                value=""
                onChange={e => selectOutputItem(e.target.value)}
                className="mill-out-search"
              >
                <option value="">{t('mill.search_output')}</option>
                {sellableItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit_abbreviation})
                  </option>
                ))}
              </select>
            </div>

            <label className="mill-field" style={{ marginTop: '0.75rem', maxWidth: '400px' }}>
              <span>{t('common.notes')} ({t('common.optional')})</span>
              <input
                type="text"
                value={notes}
                placeholder="e.g. morning batch, slight moisture"
                onChange={e => setNotes(e.target.value)}
              />
            </label>

            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button
                className="btn-primary"
                onClick={runBatch}
                disabled={saving || !inputQty || parseFloat(inputQty) <= 0 || outputs.length === 0}
              >
                {saving ? t('mill.running') : t('mill.run_batch')}
              </button>
              <button className="btn-ghost" onClick={() => { setInputItem(null); setOutputs([]); setInputQty(''); setError('') }}>
                Clear
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Recent batches ─────────────────────────────────────── */}
      <div className="mill-step-label" style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>
        <span className="mill-step-num" style={{ background: '#a8a29e' }}>↓</span>
        {t('mill.recent')}
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('common.date')}</th>
            <th>{t('mill.input_item')}</th>
            <th style={{ textAlign: 'right' }}>{t('mill.input_qty')}</th>
          </tr>
        </thead>
        <tbody>
          {batches.length === 0 && (
            <tr><td colSpan={3} className="empty-state">{t('mill.no_batches')}</td></tr>
          )}
          {batches.map(b => (
            <tr key={b.id}>
              <td className="text-muted">{fmtDate(b.created_at)}</td>
              <td style={{ fontWeight: 500 }}>
                {b.input_item_name}
                {b.input_variant_name && b.input_variant_name !== b.input_item_name && (
                  <span className="text-muted"> · {b.input_variant_name}</span>
                )}
              </td>
              <td style={{ textAlign: 'right' }}>
                {b.input_qty} {b.input_unit_abbreviation}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

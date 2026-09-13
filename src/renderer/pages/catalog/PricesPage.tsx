import { useEffect, useState } from 'react'
import type { PriceListEntry } from '../../../shared/types/api'
import { useLanguage } from '../../i18n'

type PriceTab = 'sell' | 'processing'

interface InlineForm {
  itemId: number
  variantId: number
  unitId: number
  price: string
  effectiveFrom: string
}

function today() { return new Date().toISOString().slice(0, 10) }

export default function PricesPage() {
  const { t, fmtAmt } = useLanguage()
  const [tab, setTab] = useState<PriceTab>('sell')
  const [entries, setEntries] = useState<PriceListEntry[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [inlineForm, setInlineForm] = useState<InlineForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function load(priceType: PriceTab) {
    setLoading(true)
    try {
      const res = await window.api.prices.getAllCurrent(priceType)
      if (res.ok && res.data) setEntries(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setInlineForm(null)
    setSaveError('')
    setSearch('')
    load(tab)
  }, [tab])

  function openForm(e: PriceListEntry) {
    setInlineForm({
      itemId: e.item_id,
      variantId: e.variant_id,
      unitId: e.unit_id,
      price: e.price !== null ? String(e.price) : '',
      effectiveFrom: today(),
    })
    setSaveError('')
  }

  async function submitPrice() {
    if (!inlineForm) return
    const price = parseFloat(inlineForm.price)
    if (isNaN(price) || price < 0) { setSaveError('Enter a valid price'); return }
    setSaving(true); setSaveError('')
    try {
      const res = await window.api.prices.set(
        inlineForm.itemId,
        inlineForm.variantId,
        inlineForm.unitId,
        price,
        tab,
        inlineForm.effectiveFrom
      )
      if (!res.ok) { setSaveError(res.error ?? 'Save failed'); return }
      setInlineForm(null)
      load(tab)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const filtered = search.trim()
    ? entries.filter(e =>
        e.item_name.toLowerCase().includes(search.toLowerCase()) ||
        e.variant_name.toLowerCase().includes(search.toLowerCase())
      )
    : entries

  const grouped: Map<number, { itemName: string; rows: PriceListEntry[] }> = new Map()
  for (const e of filtered) {
    if (!grouped.has(e.item_id)) grouped.set(e.item_id, { itemName: e.item_name, rows: [] })
    grouped.get(e.item_id)!.rows.push(e)
  }

  const tabLabel = tab === 'sell' ? t('prices.sell_label') : t('prices.processing_label')

  return (
    <div className="catalog-page" style={{ maxWidth: 780 }}>
      <div className="catalog-header">
        <h2>{t('prices.title')}</h2>
      </div>

      <div className="price-tabs">
        <button
          className={`price-tab-btn${tab === 'sell' ? ' price-tab-active' : ''}`}
          onClick={() => setTab('sell')}
        >
          {t('prices.sell_tab')}
        </button>
        <button
          className={`price-tab-btn${tab === 'processing' ? ' price-tab-active' : ''}`}
          onClick={() => setTab('processing')}
        >
          {t('prices.processing_tab')}
        </button>
      </div>

      <div className="catalog-filters" style={{ marginTop: '0.75rem' }}>
        <input
          type="text"
          placeholder={t('common.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {loading ? (
        <div className="empty-state">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">{t('common.no_data')}</div>
      ) : (
        <div className="price-list">
          {[...grouped.values()].map(group => (
            <div key={group.rows[0].item_id} className="price-group">
              <div className="price-group-name">{group.itemName}</div>
              <table className="data-table" style={{ marginTop: '0.35rem', marginBottom: '0.75rem' }}>
                <thead>
                  <tr>
                    <th>{t('bill.variant')}</th>
                    <th style={{ textAlign: 'right' }}>{tabLabel}</th>
                    <th>{t('stock.unit')}</th>
                    <th>{t('prices.since')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map(e => (
                    <tr key={e.variant_id}>
                      <td style={{ fontWeight: 600 }}>{e.variant_name}</td>
                      <td style={{ textAlign: 'right' }}>
                        {e.price !== null
                          ? <strong>{fmtAmt(Number(e.price))}</strong>
                          : <span className="text-muted">{t('prices.not_set')}</span>}
                      </td>
                      <td className="text-muted">/{e.unit_abbr}</td>
                      <td className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {e.effective_from ?? '—'}
                      </td>
                      <td>
                        <button
                          className={e.price !== null ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'}
                          onClick={() => openForm(e)}
                        >
                          {e.price !== null ? t('prices.update') : t('prices.set_price')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {group.rows.some(e => inlineForm?.variantId === e.variant_id && inlineForm?.itemId === e.item_id) && (
                <div className="price-inline-form">
                  {saveError && <div className="form-error" style={{ marginBottom: '0.5rem' }}>{saveError}</div>}
                  <div className="price-inline-form-row">
                    <div>
                      <div className="bill-field-label">
                        {tabLabel} (Rs./{group.rows.find(e => e.variant_id === inlineForm?.variantId)?.unit_abbr})
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.3rem' }}>
                        <input
                          type="number" step="0.01" min="0"
                          className="bill-input"
                          style={{ width: 140 }}
                          value={inlineForm?.price ?? ''}
                          onChange={e => setInlineForm(f => f ? { ...f, price: e.target.value } : f)}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') submitPrice() }}
                          placeholder="0.00"
                        />
                        <div>
                          <div className="bill-field-label">{t('prices.effective_from')}</div>
                          <input
                            type="date"
                            className="bill-input"
                            style={{ width: 150, marginTop: '0.3rem' }}
                            value={inlineForm?.effectiveFrom ?? today()}
                            onChange={e => setInlineForm(f => f ? { ...f, effectiveFrom: e.target.value } : f)}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignSelf: 'flex-end' }}>
                          <button className="btn-primary btn-sm" onClick={submitPrice} disabled={saving}>
                            {saving ? t('common.saving') : t('common.save')}
                          </button>
                          <button className="btn-ghost btn-sm" onClick={() => { setInlineForm(null); setSaveError('') }}>
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

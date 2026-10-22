import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Plus, X, CheckCircle } from 'lucide-react'
import logoUrl from '../../assets/logo.svg'
import type {
  AuthUser, ItemRow, VariantRow, CustomerWithBalance,
  BillWithCustomer, BillLineWithDetail, BusinessRow,
} from '../../../shared/types/api'
import type { AmendData } from './BillsPage'
import PrintReceipt from '../../components/PrintReceipt'
import { useLanguage } from '../../i18n'

interface Props {
  currentUser: AuthUser
  amendData?: AmendData | null
  onAmendComplete?: () => void
}

type PayMode = 'credit' | 'paid'

interface DraftLine {
  key: string
  itemId: number
  variantId: number | null
  itemName: string
  variantName: string | null
  unitId: number
  unitAbbr: string
  rate: number
  qty: number
  lineTotal: number
  lineType: 'sale' | 'processing'
}

const PAID_METHODS = [
  { id: 'cash',    labelKey: 'bill.cash_method' },
  { id: 'digital', labelKey: 'bill.digital_method' },
] as const

export default function NewBillPage({ currentUser, amendData, onAmendComplete }: Props) {
  const { t, fmtAmt } = useLanguage()

  const [showing, setShowing] = useState<'landing' | 'form'>('landing')
  const [addLineType, setAddLineType] = useState<'sale' | 'processing'>('processing')
  const [payMode, setPayMode] = useState<PayMode>('paid')
  const [customer, setCustomer] = useState<CustomerWithBalance | null>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerWithBalance[]>([])
  const [showCustomerDrop, setShowCustomerDrop] = useState(false)
  const [lines, setLines] = useState<DraftLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'digital'>('cash')
  const [partialPayAmount, setPartialPayAmount] = useState('')
  const [billNumber, setBillNumber] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [amendsBillId, setAmendsBillId] = useState<number | null>(null)

  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessRow | null>(null)

  const [itemQuery, setItemQuery] = useState('')
  const [itemSuggestions, setItemSuggestions] = useState<ItemRow[]>([])
  const [showItemDrop, setShowItemDrop] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ItemRow | null>(null)
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
  const [currentRate, setCurrentRate] = useState<number>(0)
  const [entryQty, setEntryQty] = useState('')
  const [entryAmount, setEntryAmount] = useState('')

  const [printBill, setPrintBill] = useState<BillWithCustomer | null>(null)
  const [printLines, setPrintLines] = useState<BillLineWithDetail[]>([])

  const itemInputRef = useRef<HTMLInputElement>(null)

  function handleQtyChange(val: string) {
    setEntryQty(val)
    const qty = parseFloat(val)
    setEntryAmount(!isNaN(qty) && currentRate > 0 ? (qty * currentRate).toFixed(2) : '')
  }

  function handleAmountChange(val: string) {
    setEntryAmount(val)
    const amt = parseFloat(val)
    setEntryQty(!isNaN(amt) && currentRate > 0 ? String(parseFloat((amt / currentRate).toFixed(4))) : '')
  }

  useEffect(() => {
    if (!entryQty) return
    const qty = parseFloat(entryQty)
    setEntryAmount(!isNaN(qty) && currentRate > 0 ? (qty * currentRate).toFixed(2) : '')
  }, [currentRate])

  const grandTotal = lines.reduce((s, l) => s + l.lineTotal, 0)
  const partialNow = payMode === 'credit' ? Math.min(parseFloat(partialPayAmount) || 0, grandTotal) : 0
  const effectivePaid = payMode === 'paid' ? grandTotal : partialNow
  const dueAmount = grandTotal - effectivePaid

  function tpl(key: string, vals: Record<string, string>) {
    return t(key).replace(/\{(\w+)\}/g, (_, k) => vals[k] ?? '')
  }

  useEffect(() => {
    window.api.businesses.getAll().then(r => {
      if (r.ok && r.data) setBusinesses(r.data)
    })
  }, [])

  useEffect(() => {
    if (!amendData) return
    setShowing('form')
    setAmendsBillId(amendData.amendsBillId)
    setPayMode(amendData.customer ? 'credit' : 'paid')
    if (amendData.customer && amendData.paidAmount > 0) {
      setPartialPayAmount(String(amendData.paidAmount))
    }
    setCustomer(amendData.customer)
    setCustomerQuery(amendData.customer?.name ?? '')
    setLines(amendData.lines.map((l, i) => ({
      key: `amend-${i}`,
      itemId: l.item_id,
      variantId: l.variant_id,
      itemName: l.item_name,
      variantName: l.variant_name !== l.item_name ? l.variant_name : null,
      unitId: l.unit_id,
      unitAbbr: l.unit_abbreviation,
      rate: l.rate_snapshot,
      qty: l.qty,
      lineTotal: l.line_total,
      lineType: l.line_type ?? 'sale',
    })))
    onAmendComplete?.()
  }, [amendData])

  function resetAll() {
    setShowing('landing')
    setAmendsBillId(null)
    setAddLineType('processing')
    setPayMode('paid')
    setCustomer(null); setCustomerQuery(''); setCustomerSuggestions([])
    setLines([])
    setPaymentMethod('cash'); setPartialPayAmount('')
    setItemQuery(''); setItemSuggestions([]); setShowItemDrop(false)
    setSelectedItem(null); setVariants([])
    setSelectedVariantId(null); setCurrentRate(0); setEntryQty(''); setEntryAmount('')
    setShowConfirm(false); setSaveError('')
    setSelectedBusiness(null); setBillNumber('')
  }

  async function selectBusiness(biz: BusinessRow) {
    setSelectedBusiness(biz)
    const r = await window.api.bills.getNextNumber(biz.id)
    if (r.ok && r.data) setBillNumber(r.data.billNumber)
  }

  async function searchCustomers(q: string) {
    setCustomerQuery(q)
    if (!q.trim()) { setCustomerSuggestions([]); setShowCustomerDrop(false); return }
    const res = await window.api.customers.search(q)
    if (res.ok && res.data) { setCustomerSuggestions(res.data); setShowCustomerDrop(true) }
  }

  function selectCustomer(c: CustomerWithBalance) {
    setCustomer(c); setCustomerQuery(c.name); setShowCustomerDrop(false)
    setPayMode('credit')
  }

  async function searchItems(q: string) {
    setItemQuery(q)
    setSelectedItem(null); setVariants([]); setSelectedVariantId(null); setCurrentRate(0); setEntryAmount('')
    if (!q.trim()) { setItemSuggestions([]); setShowItemDrop(false); return }
    const filter = addLineType === 'processing' ? { processable: true } : { sellable: true }
    const res = await window.api.items.search(q, filter)
    if (res.ok && res.data) { setItemSuggestions(res.data); setShowItemDrop(true) }
  }

  async function selectItem(item: ItemRow) {
    setSelectedItem(item)
    setItemQuery(item.name)
    setShowItemDrop(false)
    setVariants([]); setSelectedVariantId(null); setCurrentRate(0); setEntryQty(''); setEntryAmount('')

    const vRes = await window.api.variants.getByItem(item.id)
    const activeVariants = (vRes.data ?? []).filter(v => v.is_active)
    setVariants(activeVariants)

    const defaultV = activeVariants.find(v => v.is_default) ?? activeVariants[0] ?? null
    const varId = defaultV?.id ?? null
    setSelectedVariantId(varId)

    await loadRate(item.id, varId, item.default_unit_id)
  }

  async function loadRate(itemId: number, variantId: number | null, unitId: number) {
    const pRes = await window.api.prices.getCurrent(itemId)
    if (!pRes.ok || !pRes.data) { setCurrentRate(0); return }
    const prices = pRes.data
    const type = addLineType === 'processing' ? 'processing' : 'sell'
    // 1. exact variant + unit match
    const match =
      prices.find(p => p.price_type === type && p.variant_id === variantId && p.unit_id === unitId)
      // 2. null-variant (global) price for the same unit
      ?? prices.find(p => p.price_type === type && p.variant_id === null && p.unit_id === unitId)
      // 3. any price for this variant (any unit)
      ?? prices.find(p => p.price_type === type && p.variant_id === variantId)
      // 4. any price for this type at all
      ?? prices.find(p => p.price_type === type)
    setCurrentRate(match?.price ?? 0)
  }

  function handleVariantChange(varId: number) {
    setSelectedVariantId(varId)
    if (selectedItem) loadRate(selectedItem.id, varId, selectedItem.default_unit_id)
  }

  function addLine() {
    if (!selectedItem || !entryQty || parseFloat(entryQty) <= 0) return
    const qty = parseFloat(entryQty)
    const lineTotal = parseFloat((qty * currentRate).toFixed(2))
    const variantName = variants.find(v => v.id === selectedVariantId)?.name ?? null
    setLines(prev => [...prev, {
      key: `${Date.now()}`,
      itemId: selectedItem.id,
      variantId: selectedVariantId,
      itemName: selectedItem.name,
      variantName: variantName !== selectedItem.name ? variantName : null,
      unitId: selectedItem.default_unit_id,
      unitAbbr: selectedItem.unit_abbreviation,
      rate: currentRate,
      qty,
      lineTotal,
      lineType: addLineType,
    }])
    setItemQuery(''); setSelectedItem(null); setVariants([])
    setSelectedVariantId(null); setCurrentRate(0); setEntryQty(''); setEntryAmount('')
  }

  function removeLine(key: string) {
    setLines(prev => prev.filter(l => l.key !== key))
  }

  async function handleConfirmSave() {
    if (saving) return
    setSaving(true); setSaveError('')
    try {
      const paid = effectivePaid
      const method: 'cash' | 'digital' | 'credit' =
        payMode === 'paid' ? paymentMethod
        : partialNow > 0 ? paymentMethod
        : 'credit'

      const createRes = await window.api.bills.create({
        businessId: selectedBusiness!.id,
        customerId: customer?.id ?? null,
        lines: lines.map((l, idx) => ({
          itemId: l.itemId,
          variantId: l.variantId,
          qty: l.qty,
          unitId: l.unitId,
          rateSnapshot: l.rate,
          lineDiscount: 0,
          lineTotal: l.lineTotal,
          sortOrder: idx,
          lineType: l.lineType,
        })),
        discountAmount: 0,
        paidAmount: paid,
        paymentMethod: method,
        operatorId: currentUser.id,
        amendsBillId,
      })

      if (!createRes.ok || !createRes.data) {
        setSaveError(createRes.error ?? 'Save failed'); setSaving(false); return
      }

      const { billId } = createRes.data
      const [billRes, linesRes] = await Promise.all([
        window.api.bills.getById(billId),
        window.api.bills.getLines(billId),
      ])
      if (billRes.ok && billRes.data && linesRes.ok && linesRes.data) {
        setPrintBill(billRes.data)
        setPrintLines(linesRes.data)
      }

      setShowConfirm(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setSaving(false)
    }
  }

  function canReview(): boolean {
    if (lines.length === 0) return false
    if (payMode === 'credit' && !customer) return false
    return true
  }

  function handlePrintClose() {
    setPrintBill(null); setPrintLines([])
    resetAll()
  }

  // ─── Print overlay ─────────────────────────────────────────────────────────
  if (printBill) {
    return <PrintReceipt bill={printBill} lines={printLines} business={selectedBusiness!} onClose={handlePrintClose} />
  }

  // ─── Landing ───────────────────────────────────────────────────────────────
  if (showing === 'landing') {
    return (
      <div className="new-txn-landing">
        <div className="new-txn-inner">
          <div className="new-txn-hero">
            <img src={logoUrl} alt="logo" className="new-txn-logo" />
            <h1 className="new-txn-mill-name">{selectedBusiness?.name ?? 'Badachuli Rice Mill'}</h1>
            <p className="new-txn-mill-sub">बडचुली राइस मिल</p>
          </div>
          <p className="new-txn-eyebrow">{t('bill.new_txn_eyebrow')}</p>
          <button className="new-txn-pill" onClick={() => setShowing('form')}>
            <span className="new-txn-pill-icon"><Plus size={22} strokeWidth={2.5} /></span>
            <span className="new-txn-pill-text">{t('bill.new_transaction')}</span>
          </button>
          <p className="new-txn-hint">{t('bill.new_txn_hint')}</p>
        </div>
      </div>
    )
  }

  // ─── Entry Form ────────────────────────────────────────────────────────────
  return (
    <div className="bill-entry-page">
      {/* Header */}
      <div className="bill-entry-topbar">
        <button className="bill-back-btn" onClick={resetAll}>
          <ChevronLeft size={16} /> {t('common.back')}
        </button>
        <span className="bill-number-badge">{billNumber || '—'}</span>
      </div>

      <div className="bill-entry-body">
        {/* LEFT: Form */}
        <div className="bill-entry-left">

          {/* Payment Toggle */}
          <section className="bill-section">
            <div className="bill-section-title">{t('bill.pay_mode_section')}</div>
            <div className="pay-toggle">
              <button
                className={`pay-toggle-btn${payMode === 'paid' ? ' pay-toggle-active' : ''}`}
                onClick={() => setPayMode('paid')}
              >
                {t('bill.pay_now_btn')}
              </button>
              <button
                className={`pay-toggle-btn${payMode === 'credit' ? ' pay-toggle-active' : ''}`}
                onClick={() => setPayMode('credit')}
              >
                {t('bill.credit_btn')}
              </button>
            </div>
          </section>

          {/* Customer */}
          <section className="bill-section">
            <div className="bill-section-title">
              {t('bill.customer')}
              {payMode === 'credit' && (
                <span className="bill-required"> {t('bill.credit_required')}</span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="bill-input"
                placeholder={t('bill.search_customer')}
                value={customerQuery}
                onChange={e => searchCustomers(e.target.value)}
                onFocus={async () => {
                  if (customerSuggestions.length) { setShowCustomerDrop(true); return }
                  const res = await window.api.customers.search('')
                  if (res.ok && res.data?.length) {
                    setCustomerSuggestions(res.data)
                    setShowCustomerDrop(true)
                  }
                }}
                onBlur={() => setTimeout(() => setShowCustomerDrop(false), 150)}
              />
              {showCustomerDrop && customerSuggestions.length > 0 && (
                <ul className="dropdown-list">
                  {customerSuggestions.map(c => (
                    <li key={c.id} onMouseDown={() => selectCustomer(c)}>
                      <span>{c.name}</span>
                      <span className="text-muted">{c.phone ?? ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {customer && (
              <div className="customer-card">
                <div className="customer-card-name">{customer.name}</div>
                {customer.phone && <div className="customer-card-meta">{customer.phone}</div>}
                {customer.outstanding > 0.005 && (
                  <div className="customer-card-outstanding">
                    {t('bill.outstanding_note')}: {fmtAmt(customer.outstanding)}
                  </div>
                )}
                {customer.outstanding < -0.005 && (
                  <div className="customer-card-outstanding" style={{ color: '#15803d' }}>
                    {t('customer.credit_label')}: {fmtAmt(Math.abs(customer.outstanding))}
                  </div>
                )}
                <button
                  className="customer-card-clear"
                  onClick={() => { setCustomer(null); setCustomerQuery(''); setPayMode('paid') }}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </section>

          {/* Items */}
          <section className="bill-section">
            <div className="bill-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {t('bill.items_label')}
              <div className="pay-toggle" style={{ marginLeft: 'auto' }}>
                <button
                  className={`pay-toggle-btn${addLineType === 'sale' ? ' pay-toggle-active' : ''}`}
                  onClick={() => {
                    setAddLineType('sale')
                    setSelectedItem(null); setItemQuery(''); setItemSuggestions([]); setCurrentRate(0); setEntryQty(''); setEntryAmount('')
                  }}
                >
                  {t('bill.type_sale')}
                </button>
                <button
                  className={`pay-toggle-btn${addLineType === 'processing' ? ' pay-toggle-active' : ''}`}
                  onClick={() => {
                    setAddLineType('processing')
                    setSelectedItem(null); setItemQuery(''); setItemSuggestions([]); setCurrentRate(0); setEntryQty(''); setEntryAmount('')
                  }}
                >
                  {t('bill.type_processing')}
                </button>
              </div>
            </div>

            <div className="bill-item-entry">
              <div style={{ position: 'relative', flex: 2 }}>
                <input
                  ref={itemInputRef}
                  type="text"
                  className="bill-input"
                  placeholder={t('bill.search_item')}
                  value={itemQuery}
                  onChange={e => searchItems(e.target.value)}
                  onFocus={async () => {
                    if (itemSuggestions.length) { setShowItemDrop(true); return }
                    const filter = addLineType === 'processing' ? { processable: true } : { sellable: true }
                    const res = await window.api.items.search('', filter)
                    if (res.ok && res.data?.length) {
                      setItemSuggestions(res.data)
                      setShowItemDrop(true)
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowItemDrop(false), 150)}
                />
                {showItemDrop && itemSuggestions.length > 0 && (
                  <ul className="dropdown-list">
                    {itemSuggestions.map(item => (
                      <li key={item.id} onMouseDown={() => selectItem(item)}>
                        <span>{item.name}</span>
                        <span className="text-muted">{item.unit_abbreviation}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selectedItem && variants.length > 1 && (
                <select
                  className="bill-input bill-input-sm"
                  value={selectedVariantId ?? ''}
                  onChange={e => handleVariantChange(parseInt(e.target.value))}
                >
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              )}

              {selectedItem && (
                <>
                  <div className="bill-rate-display">
                    <span className="bill-rate-label">{t('bill.rate')}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="bill-input bill-input-sm"
                      value={currentRate}
                      onChange={e => {
                        const r = parseFloat(e.target.value) || 0
                        setCurrentRate(r)
                        const qty = parseFloat(entryQty)
                        if (!isNaN(qty) && r > 0) setEntryAmount((qty * r).toFixed(2))
                      }}
                      style={{ width: '80px' }}
                    />
                  </div>
                  <div className="bill-qty-amount-row">
                    <input
                      type="number" step="any" min="0"
                      className="bill-input"
                      placeholder={`${t('bill.qty')} (${selectedItem.unit_abbreviation})`}
                      value={entryQty}
                      onChange={e => handleQtyChange(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addLine() }}
                      autoFocus
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number" step="0.01" min="0"
                      className="bill-input"
                      placeholder={t('common.amount')}
                      value={entryAmount}
                      onChange={e => handleAmountChange(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addLine() }}
                      style={{ flex: 1 }}
                    />
                    <button className="btn-primary btn-sm" onClick={addLine}>
                      <Plus size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>

            {lines.length > 0 ? (
              <table className="data-table" style={{ marginTop: '0.75rem' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('bill.item')}</th>
                    <th style={{ textAlign: 'right' }}>{t('bill.qty')}</th>
                    <th style={{ textAlign: 'right' }}>{t('bill.rate')}</th>
                    <th style={{ textAlign: 'right' }}>{t('bill.total')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={l.key}>
                      <td className="text-muted">{idx + 1}</td>
                      <td>
                        {l.itemName}
                        {l.variantName && <span className="text-muted"> · {l.variantName}</span>}
                        <span
                          style={{
                            marginLeft: '0.4rem',
                            fontSize: '0.68rem',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: l.lineType === 'processing' ? '#a16207' : '#f97316',
                            color: '#fff',
                            verticalAlign: 'middle',
                          }}
                        >
                          {l.lineType === 'processing' ? t('bill.type_processing') : t('bill.type_sale')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{l.qty} {l.unitAbbr}</td>
                      <td style={{ textAlign: 'right' }}>{fmtAmt(l.rate)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtAmt(l.lineTotal)}</td>
                      <td>
                        <button className="btn-ghost btn-sm" onClick={() => removeLine(l.key)}>
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state" style={{ padding: '1rem' }}>{t('bill.no_items_yet')}</div>
            )}
          </section>

          {/* Payment */}
          <section className="bill-section">
            <div className="bill-section-title">{t('bill.payment_section')}</div>
            {payMode === 'paid' ? (
              <div className="bill-payment-row">
                <div className="bill-field-label" style={{ marginBottom: '0.5rem' }}>{t('bill.payment_method')}</div>
                <div className="bill-method-pills">
                  {PAID_METHODS.map(m => (
                    <button
                      key={m.id}
                      className={`bill-method-pill${paymentMethod === m.id ? ' bill-method-active' : ''}`}
                      onClick={() => setPaymentMethod(m.id)}
                    >
                      {t(m.labelKey)}
                    </button>
                  ))}
                </div>
                <div className="bill-udharo-note" style={{ color: '#15803d', marginTop: '0.6rem' }}>
                  {tpl('bill.paid_full_note', { amount: fmtAmt(grandTotal) })}
                </div>
              </div>
            ) : (
              <div className="bill-payment-row">
                <div className="bill-udharo-note">
                  {t('bill.credit_note')}
                </div>
                <div className="bill-field-label" style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>{t('bill.payment_method')}</div>
                <div className="bill-method-pills">
                  {PAID_METHODS.map(m => (
                    <button
                      key={m.id}
                      className={`bill-method-pill${paymentMethod === m.id ? ' bill-method-active' : ''}`}
                      onClick={() => setPaymentMethod(m.id)}
                    >
                      {t(m.labelKey)}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '0.75rem' }}>
                  <div className="bill-field-label">{t('bill.partial_label')}</div>
                  <input
                    type="number" step="0.01" min="0"
                    className="bill-input bill-input-sm"
                    style={{ marginTop: '0.3rem' }}
                    value={partialPayAmount}
                    onChange={e => setPartialPayAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                {partialNow > 0 && (
                  <div className="bill-partial-note">
                    {tpl('bill.partial_collected_note', { paid: fmtAmt(partialNow), due: fmtAmt(dueAmount) })}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: Summary */}
        <div className="bill-summary">
          <div className="bill-summary-title">{t('bill.summary_title')}</div>

          <div className="bill-summary-lines">
            {lines.map(l => (
              <div key={l.key} className="bill-summary-line">
                <span className="bill-summary-line-name">
                  {l.itemName}{l.variantName ? ` (${l.variantName})` : ''} × {l.qty}{l.unitAbbr}
                </span>
                <span>{fmtAmt(l.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="bill-summary-divider" />

          <div className="bill-summary-row">
            <span>{t('bill.grand_total')}</span>
            <span className="bill-summary-total">{fmtAmt(grandTotal)}</span>
          </div>

          {effectivePaid > 0 && (
            <div className="bill-summary-row">
              <span>{payMode === 'paid' ? t('bill.paid') : t('bill.collected_now')}</span>
              <span style={{ color: '#15803d', fontWeight: 700 }}>{fmtAmt(effectivePaid)}</span>
            </div>
          )}

          {dueAmount > 0.005 && (
            <div className="bill-summary-row">
              <span>{t('bill.credit_balance')}</span>
              <span style={{ color: '#dc2626', fontWeight: 700 }}>{fmtAmt(dueAmount)}</span>
            </div>
          )}

          <div className="bill-summary-divider" />

          <button
            className="btn-primary"
            style={{ width: '100%', padding: '0.7rem' }}
            disabled={!canReview()}
            onClick={() => setShowConfirm(true)}
          >
            {t('bill.review_save_btn')}
          </button>
          {!customer && payMode === 'credit' && (
            <div className="form-error" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
              {t('bill.need_customer_credit')}
            </div>
          )}
        </div>
      </div>

      {/* ─── STEP 3 — Confirmation Modal ──────────────────────────────────────── */}
      {showConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <div className="confirm-modal-header">
              <CheckCircle size={20} color="#f97316" />
              <span>{t('bill.confirm_title')}</span>
            </div>

            <div className="confirm-biz-label">{t('bill.which_business')}</div>
            <div className="confirm-biz-tiles">
              {businesses.map(biz => (
                <button
                  key={biz.id}
                  className={`confirm-biz-tile${selectedBusiness?.id === biz.id ? ' confirm-biz-tile-active' : ''}`}
                  onClick={() => selectBusiness(biz)}
                >
                  <div className="confirm-biz-name">{biz.name}</div>
                  {biz.pan_number && <div className="confirm-biz-pan">PAN: {biz.pan_number}</div>}
                  {biz.bill_prefix && <div className="confirm-biz-prefix">{biz.bill_prefix}-XXXX</div>}
                </button>
              ))}
            </div>

            <div className="confirm-detail-row">
              <span className="confirm-label">{t('bill.number')}</span>
              <span className="confirm-value">{billNumber || (selectedBusiness ? '…' : '—')}</span>
            </div>
            <div className="confirm-detail-row">
              <span className="confirm-label">{t('bill.type')}</span>
              <span className="confirm-value">
                {(() => {
                  const types = new Set(lines.map(l => l.lineType))
                  if (types.size > 1) return `${t('bill.type_sale')} + ${t('bill.type_processing')}`
                  return types.has('processing') ? t('bill.type_processing') : t('bill.type_sale')
                })()}
              </span>
            </div>
            {customer && (
              <div className="confirm-detail-row">
                <span className="confirm-label">{t('bill.customer')}</span>
                <span className="confirm-value">
                  {customer.name}
                  {customer.outstanding > 0 && (
                    <span style={{ color: '#dc2626', fontSize: '0.78rem', marginLeft: '0.5rem' }}>
                      ({t('bill.outstanding_note')}: {fmtAmt(customer.outstanding)})
                    </span>
                  )}
                </span>
              </div>
            )}

            <div className="confirm-divider" />

            <div className="confirm-items-header">
              <span style={{ flex: 3 }}>{t('bill.item')}</span>
              <span style={{ flex: 1, textAlign: 'right' }}>{t('bill.qty')}</span>
              <span style={{ flex: 1, textAlign: 'right' }}>{t('bill.rate')}</span>
              <span style={{ flex: 1, textAlign: 'right' }}>{t('bill.total')}</span>
            </div>
            {lines.map(l => (
              <div key={l.key} className="confirm-item-row">
                <span style={{ flex: 3 }}>
                  {l.itemName}{l.variantName ? ` (${l.variantName})` : ''}
                  <span
                    style={{
                      marginLeft: '0.3rem',
                      fontSize: '0.65rem',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      background: l.lineType === 'processing' ? '#a16207' : '#f97316',
                      color: '#fff',
                      verticalAlign: 'middle',
                    }}
                  >
                    {l.lineType === 'processing' ? t('bill.type_processing') : t('bill.type_sale')}
                  </span>
                </span>
                <span style={{ flex: 1, textAlign: 'right' }}>{l.qty} {l.unitAbbr}</span>
                <span style={{ flex: 1, textAlign: 'right' }}>{fmtAmt(l.rate)}</span>
                <span style={{ flex: 1, textAlign: 'right', fontWeight: 700 }}>{fmtAmt(l.lineTotal)}</span>
              </div>
            ))}

            <div className="confirm-divider" />

            <div className="confirm-totals">
              <div className="confirm-total-row">
                <span>{t('bill.grand_total')}</span>
                <span className="confirm-grand-total">{fmtAmt(grandTotal)}</span>
              </div>
              {payMode === 'paid' && (
                <div className="confirm-total-row">
                  <span>{t('bill.payment_method')} ({t(`bill.${paymentMethod}_method`)})</span>
                  <span style={{ color: '#15803d', fontWeight: 700 }}>{fmtAmt(grandTotal)}</span>
                </div>
              )}
              {payMode === 'credit' && partialNow > 0 && (
                <div className="confirm-total-row">
                  <span>{t('bill.collected_now')} ({t(`bill.${paymentMethod}_method`)})</span>
                  <span style={{ color: '#15803d', fontWeight: 700 }}>{fmtAmt(partialNow)}</span>
                </div>
              )}
              {dueAmount > 0.005 && (
                <div className="confirm-total-row confirm-due-row">
                  <span>{t('bill.going_to_credit')}</span>
                  <span>{fmtAmt(dueAmount)}</span>
                </div>
              )}
              {payMode === 'credit' && partialNow === 0 && (
                <div className="confirm-total-row">
                  <span>{t('bill.full_on_credit')}</span>
                  <span style={{ color: '#b45309', fontWeight: 700 }}>{fmtAmt(grandTotal)}</span>
                </div>
              )}
            </div>

            {saveError && <div className="form-error" style={{ marginTop: '0.5rem' }}>{saveError}</div>}

            <div className="confirm-actions">
              <button className="btn-primary" onClick={handleConfirmSave} disabled={saving || !selectedBusiness}>
                {saving ? t('bill.saving_label') : t('bill.confirm_save_print')}
              </button>
              <button className="btn-ghost" onClick={() => { setShowConfirm(false); setSaveError('') }}>
                {t('bill.go_back_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

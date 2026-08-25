import { useEffect, useRef, useState } from 'react'
import type {
  AuthUser, CustomerWithBalance, ItemRow, VariantRow, UnitRow,
  BillLineInput, CreateBillInput, BillWithCustomer, BillLineWithDetail,
} from '../../../shared/types/api'
import PrintReceipt from '../../components/PrintReceipt'

interface Props { currentUser: AuthUser }

interface DraftLine extends BillLineInput {
  itemName: string
  variantName: string | null
  unitAbbr: string
}

const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Cash' },
  { value: 'credit', label: 'Udharo (Credit)' },
  { value: 'bank',   label: 'Bank Transfer' },
  { value: 'digital',label: 'Digital Wallet' },
]

export default function NewBillPage({ currentUser }: Props) {
  const [billNumber, setBillNumber] = useState('')
  const [customer, setCustomer] = useState<CustomerWithBalance | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<CustomerWithBalance[]>([])
  const [showCustomerDrop, setShowCustomerDrop] = useState(false)

  const [lines, setLines] = useState<DraftLine[]>([])
  const [discountAmount, setDiscountAmount] = useState('0')
  const [paidAmount, setPaidAmount] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'digital' | 'credit'>('cash')
  const [notes, setNotes] = useState('')

  // Item search state
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
  const [pendingDiscount, setPendingDiscount] = useState('0')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [printBill, setPrintBill] = useState<BillWithCustomer | null>(null)
  const [printLines, setPrintLines] = useState<BillLineWithDetail[]>([])

  const itemSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.bills.getNextNumber().then(r => {
      if (r.ok && r.data) setBillNumber(r.data.billNumber)
    })
  }, [])

  // Customer search
  useEffect(() => {
    if (!customerSearch.trim()) { setCustomerResults([]); return }
    window.api.customers.search(customerSearch).then(r => {
      if (r.ok && r.data) setCustomerResults(r.data)
    })
  }, [customerSearch])

  // Item search
  useEffect(() => {
    if (!itemSearch.trim()) { setItemResults([]); setShowItemDrop(false); return }
    window.api.items.search(itemSearch, { sellable: true }).then(r => {
      if (r.ok && r.data) { setItemResults(r.data); setShowItemDrop(true) }
    })
  }, [itemSearch])

  async function selectCustomer(c: CustomerWithBalance) {
    setCustomer(c)
    setCustomerSearch(c.name)
    setShowCustomerDrop(false)
    setCustomerResults([])
  }

  function clearCustomer() {
    setCustomer(null)
    setCustomerSearch('')
    setCustomerResults([])
  }

  async function selectItem(item: ItemRow) {
    setPendingItem(item)
    setItemSearch(item.name)
    setShowItemDrop(false)

    const [vRes, uRes, priceRes] = await Promise.all([
      window.api.variants.getByItem(item.id),
      window.api.units.getAll(),
      window.api.prices.getCurrent(item.id),
    ])

    const activeVariants = (vRes.data ?? []).filter(v => v.is_active)
    const units = uRes.data ?? []
    const defVariant = activeVariants.find(v => v.is_default) ?? activeVariants[0]
    const defUnit = units.find(u => u.id === item.default_unit_id) ?? units.find(u => u.is_default) ?? units[0]

    setPendingVariants(activeVariants)
    setPendingUnits(units)
    setPendingVariantId(defVariant ? String(defVariant.id) : '')
    setPendingUnitId(defUnit ? String(defUnit.id) : '')
    setPendingQty('')
    setPendingDiscount('0')

    // Auto-fill sell price
    const variantId = defVariant?.id ?? null
    const unitId = defUnit?.id
    const price = (priceRes.data ?? []).find(
      p => p.price_type === 'sell' &&
           p.unit_id === unitId &&
           (variantId ? p.variant_id === variantId : p.variant_id === null)
    )
    setPendingRate(price ? String(price.price) : '')
  }

  async function onPendingVariantChange(variantId: string) {
    setPendingVariantId(variantId)
    if (!pendingItem) return
    const priceRes = await window.api.prices.getCurrent(pendingItem.id)
    const vid = variantId ? parseInt(variantId) : null
    const uid = parseInt(pendingUnitId)
    const price = (priceRes.data ?? []).find(
      p => p.price_type === 'sell' && p.unit_id === uid &&
           (vid ? p.variant_id === vid : p.variant_id === null)
    )
    setPendingRate(price ? String(price.price) : '')
  }

  function addLine() {
    if (!pendingItem) return
    const qty = parseFloat(pendingQty)
    const rate = parseFloat(pendingRate)
    const discount = parseFloat(pendingDiscount) || 0
    if (isNaN(qty) || qty <= 0) return
    if (isNaN(rate) || rate < 0) return

    const lineTotal = qty * rate - discount
    const variant = pendingVariants.find(v => v.id === parseInt(pendingVariantId))
    const unit = pendingUnits.find(u => u.id === parseInt(pendingUnitId))

    const line: DraftLine = {
      itemId: pendingItem.id,
      variantId: pendingVariantId ? parseInt(pendingVariantId) : null,
      qty,
      unitId: parseInt(pendingUnitId),
      rateSnapshot: rate,
      lineDiscount: discount,
      lineTotal,
      sortOrder: lines.length,
      itemName: pendingItem.name,
      variantName: variant?.name ?? null,
      unitAbbr: unit?.abbreviation ?? '',
    }
    setLines(prev => [...prev, line])

    // Reset item entry
    setPendingItem(null)
    setItemSearch('')
    setPendingVariants([])
    setPendingQty('')
    setPendingRate('')
    setPendingDiscount('0')
    itemSearchRef.current?.focus()
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx))
  }

  // Totals
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)
  const discount = parseFloat(discountAmount) || 0
  const grandTotal = Math.max(0, subtotal - discount)
  const paid = parseFloat(paidAmount) || 0
  const due = Math.max(0, grandTotal - paid)

  async function saveBill() {
    setError('')
    if (!lines.length) { setError('Add at least one item'); return }
    setSaving(true)
    try {
      const input: CreateBillInput = {
        billType: 'sale',
        customerId: customer?.id ?? null,
        lines: lines.map(({ itemName: _a, variantName: _b, unitAbbr: _c, ...l }) => l),
        discountAmount: discount,
        paidAmount: paid,
        paymentMethod,
        notes: notes || undefined,
        operatorId: currentUser.id,
      }
      const res = await window.api.bills.create(input)
      if (!res.ok) { setError(res.error ?? 'Unknown error'); return }

      const { billId, billNumber } = res.data!
      setSuccessMsg(`Bill ${billNumber} saved`)

      // Load the saved bill for printing
      const [billRes, linesRes] = await Promise.all([
        window.api.bills.getById(billId),
        window.api.bills.getLines(billId),
      ])
      if (billRes.ok && billRes.data) {
        setPrintBill(billRes.data)
        setPrintLines(linesRes.data ?? [])
      }

      setLines([])
      setCustomer(null)
      setCustomerSearch('')
      setDiscountAmount('0')
      setPaidAmount('0')
      setNotes('')
      const next = await window.api.bills.getNextNumber()
      if (next.ok && next.data) setBillNumber(next.data.billNumber)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IPC error — restart the app')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bill-layout">
      {printBill && (
        <PrintReceipt
          bill={printBill}
          lines={printLines}
          onClose={() => setPrintBill(null)}
        />
      )}
      {/* ── Left: item entry ── */}
      <div className="bill-entry">
        <div className="bill-entry-header">
          <span className="bill-number-badge">{billNumber || '…'}</span>

          {/* Customer picker */}
          <div className="customer-picker">
            {customer ? (
              <div className="customer-selected">
                <span>{customer.name}</span>
                {customer.phone && <span className="text-muted">{customer.phone}</span>}
                {customer.outstanding > 0 && (
                  <span className="outstanding-warn">
                    Udharo: Rs. {customer.outstanding.toLocaleString()}
                  </span>
                )}
                <button className="btn-ghost btn-sm" onClick={clearCustomer}>✕</button>
              </div>
            ) : (
              <div className="customer-search-wrap">
                <input
                  type="text"
                  placeholder="Search customer (optional)"
                  value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true) }}
                  onFocus={() => setShowCustomerDrop(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDrop(false), 150)}
                  className="search-input"
                />
                {showCustomerDrop && customerResults.length > 0 && (
                  <ul className="dropdown-list">
                    {customerResults.map(c => (
                      <li key={c.id} onMouseDown={() => selectCustomer(c)}>
                        <span>{c.name}</span>
                        {c.phone && <span className="text-muted">{c.phone}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Item search */}
        <div className="item-entry-row">
          <div className="item-search-wrap" style={{ flex: 2 }}>
            <input
              ref={itemSearchRef}
              type="text"
              placeholder="Search item to add…"
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              onFocus={() => itemResults.length > 0 && setShowItemDrop(true)}
              onBlur={() => setTimeout(() => setShowItemDrop(false), 150)}
              className="search-input"
              autoFocus
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
                <select
                  value={pendingVariantId}
                  onChange={e => onPendingVariantChange(e.target.value)}
                  style={{ flex: 1 }}
                >
                  {pendingVariants.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              )}
              <input
                type="number" step="any" min="0.001"
                placeholder="Qty"
                value={pendingQty}
                onChange={e => setPendingQty(e.target.value)}
                style={{ flex: '0 0 90px' }}
                autoFocus
              />
              <select
                value={pendingUnitId}
                onChange={e => setPendingUnitId(e.target.value)}
                style={{ flex: '0 0 90px' }}
              >
                {pendingUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.abbreviation}</option>
                ))}
              </select>
              <input
                type="number" step="0.01" min="0"
                placeholder="Rate"
                value={pendingRate}
                onChange={e => setPendingRate(e.target.value)}
                style={{ flex: '0 0 100px' }}
              />
              <input
                type="number" step="0.01" min="0"
                placeholder="Discount"
                value={pendingDiscount}
                onChange={e => setPendingDiscount(e.target.value)}
                style={{ flex: '0 0 90px' }}
              />
              <button className="btn-primary btn-sm" onClick={addLine}>Add</button>
            </>
          )}
        </div>

        {/* Draft lines */}
        <table className="data-table" style={{ marginTop: '0.75rem' }}>
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Rate</th>
              <th style={{ textAlign: 'right' }}>Discount</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={6} className="empty-state">No items added yet</td></tr>
            )}
            {lines.map((l, i) => (
              <tr key={i}>
                <td>
                  {l.itemName}
                  {l.variantName && l.variantName !== l.itemName && (
                    <span className="text-muted"> · {l.variantName}</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>{l.qty} {l.unitAbbr}</td>
                <td style={{ textAlign: 'right' }}>Rs. {l.rateSnapshot.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{l.lineDiscount > 0 ? `Rs. ${l.lineDiscount}` : '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  Rs. {l.lineTotal.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                </td>
                <td><button className="btn-danger btn-sm" onClick={() => removeLine(i)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Right: bill summary ── */}
      <div className="bill-summary">
        <h3>Bill Summary</h3>

        <div className="summary-row"><span>Subtotal</span><span>Rs. {subtotal.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span></div>

        <label className="summary-input-row">
          <span>Discount (Rs.)</span>
          <input type="number" step="0.01" min="0" value={discountAmount}
            onChange={e => setDiscountAmount(e.target.value)} />
        </label>

        <div className="summary-row summary-total">
          <span>Total</span>
          <span>Rs. {grandTotal.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span>
        </div>

        <label className="summary-input-row">
          <span>Paid (Rs.)</span>
          <input type="number" step="0.01" min="0" value={paidAmount}
            onChange={e => setPaidAmount(e.target.value)} />
        </label>

        {due > 0 && (
          <div className="summary-row summary-due">
            <span>Due (Udharo)</span>
            <span>Rs. {due.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</span>
          </div>
        )}

        <label style={{ marginTop: '0.75rem' }}>
          Payment method
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as typeof paymentMethod)}>
            {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>

        <label>
          Notes (optional)
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. market delivery" />
        </label>

        {error && <p className="form-error">{error}</p>}
        {successMsg && <p className="success-msg">{successMsg}</p>}

        <button
          className="btn-primary"
          style={{ width: '100%', marginTop: '1rem', padding: '0.75rem' }}
          onClick={saveBill}
          disabled={saving || lines.length === 0}
        >
          {saving ? 'Saving…' : `Save Bill · Rs. ${grandTotal.toLocaleString('en-NP', { minimumFractionDigits: 2 })}`}
        </button>
      </div>
    </div>
  )
}

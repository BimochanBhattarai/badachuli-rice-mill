import { createPortal } from 'react-dom'
import { useState } from 'react'
import type { BillWithCustomer, BillLineWithDetail, BusinessRow } from '../../shared/types/api'

interface Props {
  bill: BillWithCustomer
  lines: BillLineWithDetail[]
  business: BusinessRow
  onClose: () => void
}

// ── Nepali utilities (mirrors print.ts) ───────────────────────────────────
const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']

function toNepaliNum(str: string | number): string {
  return String(str).replace(/[0-9]/g, d => NE_DIGITS[parseInt(d)])
}

function fmtAmtNe(n: number): string {
  const neg = n < 0
  const parts = Math.abs(n).toFixed(2).split('.')
  const whole = parseInt(parts[0]).toLocaleString('en-NP')
  return (neg ? '- ' : '') + 'रु.' + toNepaliNum(whole) + '.' + toNepaliNum(parts[1])
}

const BS_MONTHS = [
  'बैशाख','जेठ','असार','साउन','भदौ','असोज',
  'कार्तिक','मंसिर','पौष','माघ','फाल्गुन','चैत',
]

const BS_YEAR_DATA: Record<number, number[]> = {
  2070:[31,32,31,32,31,30,30,29,30,29,30,30],
  2071:[31,31,32,31,31,31,30,29,30,29,30,30],
  2072:[31,32,31,32,31,30,30,30,29,30,29,31],
  2073:[30,32,31,32,31,30,30,30,29,30,30,30],
  2074:[31,31,32,31,31,30,30,30,29,30,30,30],
  2075:[31,31,32,31,31,30,30,30,29,30,30,30],
  2076:[31,32,31,32,31,30,30,30,29,30,29,31],
  2077:[30,32,31,32,31,30,30,30,29,30,30,30],
  2078:[31,31,32,31,31,30,30,30,29,30,30,30],
  2079:[31,31,32,31,31,30,30,30,29,30,30,30],
  2080:[31,32,31,32,31,30,30,30,29,30,29,31],
  2081:[31,31,32,32,31,30,30,29,30,29,30,30],
  2082:[31,32,31,32,31,30,30,30,29,30,29,30],
  2083:[31,31,32,31,31,30,30,30,29,30,30,30],
  2084:[31,31,32,31,31,30,30,30,29,30,30,30],
  2085:[31,32,31,32,31,30,30,30,29,30,29,31],
  2086:[30,32,31,32,31,30,30,30,29,30,30,30],
  2087:[31,31,32,31,31,30,30,30,29,30,30,30],
  2088:[31,31,32,31,31,30,30,30,29,30,30,30],
  2089:[31,32,31,32,31,30,30,30,29,30,29,31],
  2090:[30,32,31,32,31,30,30,30,29,30,30,30],
}

const REF_AD = new Date(2013, 3, 14)
const REF_BS = { year: 2070, month: 1, day: 1 }

function adToBS(adDate: Date): { year: number; month: number; day: number } {
  const local = new Date(adDate.getFullYear(), adDate.getMonth(), adDate.getDate())
  const diffDays = Math.floor((local.getTime() - REF_AD.getTime()) / 86400000)
  let { year, month, day } = REF_BS
  let remaining = diffDays
  while (remaining > 0) {
    const md = BS_YEAR_DATA[year]
    if (!md) break
    const dim = md[month - 1]
    if (day + remaining <= dim) { day += remaining; remaining = 0 }
    else { remaining -= dim - day + 1; day = 1; month++; if (month > 12) { month = 1; year++ } }
  }
  return { year, month, day }
}

function fmtDateBS(s: string): string {
  const ad = new Date(s)
  if (isNaN(ad.getTime())) return s
  const { year, month, day } = adToBS(ad)
  return toNepaliNum(String(day).padStart(2, '0')) + ' ' + BS_MONTHS[month - 1] + ' ' + toNepaliNum(year)
}

export default function PrintReceipt({ bill, lines, business, onClose }: Props) {
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState('')

  async function doPrint() {
    setPrinting(true)
    setPrintError('')
    try {
      const printerIp = (await window.api.settings.get('printer_ip') as string | null) || undefined
      const res = await window.api.print.receipt(bill, lines, business, printerIp)
      if (!res.ok) setPrintError(res.error ?? 'छाप्न सकिएन')
    } catch (e) {
      setPrintError(e instanceof Error ? e.message : 'छाप्न सकिएन')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <>
      <div className="print-overlay">
        <div className="print-preview-box">
          <ReceiptContent bill={bill} lines={lines} business={business} />
          {printError && (
            <div className="form-error" style={{ margin: '0.5rem 0' }}>{printError}</div>
          )}
          <div className="print-preview-actions">
            <button className="btn-primary" onClick={doPrint} disabled={printing}>
              {printing ? 'छाप्दैछ…' : 'Print'}
            </button>
            <button className="btn-ghost" onClick={onClose}>बन्द गर्नुस्</button>
          </div>
        </div>
      </div>

      {createPortal(
        <div className="print-receipt-root">
          <ReceiptContent bill={bill} lines={lines} business={business} />
        </div>,
        document.body
      )}
    </>
  )
}

function ReceiptContent({ bill, lines, business }: {
  bill: BillWithCustomer
  lines: BillLineWithDetail[]
  business: BusinessRow
}) {
  const hasDue = bill.due_amount > 0.005

  return (
    <div className="receipt">
      {/* Header */}
      <div className="receipt-center">
        <div className="receipt-mill-name">{business.name}</div>
        {business.address    && <div className="receipt-detail">{business.address}</div>}
        {business.phone      && <div className="receipt-detail">फोन: {business.phone}</div>}
        {business.pan_number && <div className="receipt-detail">PAN: {business.pan_number}</div>}
      </div>

      <div className="receipt-divider" />

      {/* Bill meta */}
      <div className="receipt-row">
        <span>बिल नं.</span><span>{bill.bill_number}</span>
      </div>
      <div className="receipt-row">
        <span>मिति</span><span>{fmtDateBS(bill.created_at)}</span>
      </div>
      <div className="receipt-row">
        <span>प्रकार</span>
        <span>{bill.bill_type === 'processing' ? 'प्रशोधन' : 'बिक्री'}</span>
      </div>
      {bill.customer_name && (
        <div className="receipt-row">
          <span>ग्राहक</span><span>{bill.customer_name}</span>
        </div>
      )}

      <div className="receipt-divider" />

      {/* Column header */}
      <div className="receipt-line-header">
        <span className="receipt-col-item">वस्तु</span>
        <span className="receipt-col-qty">परिमाण</span>
        <span className="receipt-col-rate">दर</span>
        <span className="receipt-col-total">जम्मा</span>
      </div>

      {/* Lines — single flex row per item */}
      {lines.map(l => {
        const itemLabel = (l.variant_name && l.variant_name !== l.item_name)
          ? `${l.item_name} (${l.variant_name})`
          : l.item_name
        return (
          <div key={l.id}>
            <div className="receipt-line">
              <span className="receipt-col-item">{itemLabel}</span>
              <span className="receipt-col-qty">{toNepaliNum(l.qty)}{l.unit_abbreviation}</span>
              <span className="receipt-col-rate">{fmtAmtNe(l.rate_snapshot)}</span>
              <span className="receipt-col-total">{fmtAmtNe(l.line_total)}</span>
            </div>
            {l.line_discount > 0 && (
              <div className="receipt-line-discount">
                छूट: {fmtAmtNe(l.line_discount)}
              </div>
            )}
          </div>
        )
      })}

      <div className="receipt-divider" />

      {/* Totals */}
      <div className="receipt-row">
        <span>उप-जम्मा</span><span>{fmtAmtNe(bill.subtotal)}</span>
      </div>
      {bill.discount_amount > 0 && (
        <div className="receipt-row">
          <span>छूट</span><span>- {fmtAmtNe(bill.discount_amount)}</span>
        </div>
      )}
      <div className="receipt-row receipt-row-total">
        <span>ग्राण्ड जम्मा</span><span>{fmtAmtNe(bill.grand_total)}</span>
      </div>
      <div className="receipt-row">
        <span>तिरेको</span><span>{fmtAmtNe(bill.paid_amount)}</span>
      </div>
      {hasDue && (
        <div className="receipt-row receipt-row-due">
          <span>बाँकी (उधारो)</span><span>{fmtAmtNe(bill.due_amount)}</span>
        </div>
      )}

      <div className="receipt-divider" />

      <div className="receipt-center receipt-footer">
        {hasDue ? 'धन्यवाद — माथि उल्लेखित रकम बाँकी छ' : 'धन्यवाद!'}
      </div>
    </div>
  )
}

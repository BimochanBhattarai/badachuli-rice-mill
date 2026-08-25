import { useEffect, useState } from 'react'
import type { BillWithCustomer, BillLineWithDetail } from '../../shared/types/api'

interface MillInfo {
  mill_name: string
  mill_address: string
  mill_pan: string
  mill_phone: string
}

interface Props {
  bill: BillWithCustomer
  lines: BillLineWithDetail[]
  onClose: () => void
}

function divider(char = '─', len = 42) {
  return char.repeat(len)
}

function fmt(n: number) {
  return n.toLocaleString('en-NP', { minimumFractionDigits: 2 })
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-NP', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function PrintReceipt({ bill, lines, onClose }: Props) {
  const [mill, setMill] = useState<MillInfo>({
    mill_name: 'Rice Mill', mill_address: '', mill_pan: '', mill_phone: '',
  })

  useEffect(() => {
    async function loadMill() {
      const keys = ['mill_name', 'mill_address', 'mill_pan', 'mill_phone']
      const vals = await Promise.all(keys.map(k => window.api.settings.get(k)))
      setMill({
        mill_name:    String(vals[0] ?? 'Rice Mill'),
        mill_address: String(vals[1] ?? ''),
        mill_pan:     String(vals[2] ?? ''),
        mill_phone:   String(vals[3] ?? ''),
      })
    }
    loadMill()
  }, [])

  function doPrint() {
    window.print()
  }

  return (
    <>
      {/* ── Print preview overlay (hidden when printing) ────── */}
      <div className="print-overlay" aria-hidden="true">
        <div className="print-preview-box">
          <ReceiptContent bill={bill} lines={lines} mill={mill} />
          <div className="print-preview-actions">
            <button className="btn-primary" onClick={doPrint}>Print</button>
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {/* ── Actual print target (only element shown on paper) ── */}
      <div className="print-receipt-root">
        <ReceiptContent bill={bill} lines={lines} mill={mill} />
      </div>
    </>
  )
}

function ReceiptContent({ bill, lines, mill }: {
  bill: BillWithCustomer
  lines: BillLineWithDetail[]
  mill: MillInfo
}) {
  const hasDiscount = bill.discount_amount > 0
  const hasDue = bill.due_amount > 0

  return (
    <div className="receipt">
      {/* Header */}
      <div className="receipt-center">
        <div className="receipt-mill-name">{mill.mill_name}</div>
        {mill.mill_address && <div className="receipt-detail">{mill.mill_address}</div>}
        {mill.mill_phone   && <div className="receipt-detail">Tel: {mill.mill_phone}</div>}
        {mill.mill_pan     && <div className="receipt-detail">PAN: {mill.mill_pan}</div>}
      </div>

      <div className="receipt-divider">{divider()}</div>

      {/* Bill meta */}
      <div className="receipt-row">
        <span>Bill #</span><span>{bill.bill_number}</span>
      </div>
      <div className="receipt-row">
        <span>Date</span><span>{fmtDate(bill.created_at)}</span>
      </div>
      {bill.customer_name && (
        <div className="receipt-row">
          <span>Customer</span><span>{bill.customer_name}</span>
        </div>
      )}

      <div className="receipt-divider">{divider()}</div>

      {/* Column header */}
      <div className="receipt-line-header">
        <span className="receipt-col-item">Item</span>
        <span className="receipt-col-qty">Qty</span>
        <span className="receipt-col-rate">Rate</span>
        <span className="receipt-col-total">Total</span>
      </div>
      <div className="receipt-divider">{divider('-')}</div>

      {/* Lines */}
      {lines.map(l => {
        const itemLabel = (l.variant_name && l.variant_name !== l.item_name)
          ? `${l.item_name} (${l.variant_name})`
          : l.item_name
        return (
          <div key={l.id} className="receipt-line">
            <div className="receipt-col-item receipt-item-name">{itemLabel}</div>
            <div className="receipt-line-nums">
              <span className="receipt-col-qty">{l.qty}{l.unit_abbreviation}</span>
              <span className="receipt-col-rate">{l.rate_snapshot.toLocaleString()}</span>
              <span className="receipt-col-total">{fmt(l.line_total)}</span>
            </div>
            {l.line_discount > 0 && (
              <div className="receipt-line-discount">
                Discount: Rs. {l.line_discount.toLocaleString()}
              </div>
            )}
          </div>
        )
      })}

      <div className="receipt-divider">{divider()}</div>

      {/* Totals */}
      <div className="receipt-row">
        <span>Subtotal</span><span>Rs. {fmt(bill.subtotal)}</span>
      </div>
      {hasDiscount && (
        <div className="receipt-row">
          <span>Discount</span><span>- Rs. {fmt(bill.discount_amount)}</span>
        </div>
      )}
      <div className="receipt-row receipt-row-total">
        <span>Total</span><span>Rs. {fmt(bill.grand_total)}</span>
      </div>
      <div className="receipt-row">
        <span>Paid</span><span>Rs. {fmt(bill.paid_amount)}</span>
      </div>
      {hasDue && (
        <div className="receipt-row receipt-row-due">
          <span>Due (Udharo)</span><span>Rs. {fmt(bill.due_amount)}</span>
        </div>
      )}

      <div className="receipt-divider">{divider()}</div>

      <div className="receipt-center receipt-footer">
        {hasDue ? 'Thank you — balance due above' : 'Thank you!'}
      </div>
    </div>
  )
}

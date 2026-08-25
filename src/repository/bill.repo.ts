import Database from 'better-sqlite3'

export interface BillRow {
  id: number
  bill_number: string
  bill_type: 'sale' | 'processing'
  status: 'draft' | 'active' | 'cancelled'
  customer_id: number | null
  subtotal: number
  discount_amount: number
  taxable_amount: number
  vat_amount: number
  grand_total: number
  paid_amount: number
  due_amount: number
  notes: string | null
  operator_id: number
  created_at: string
}

export interface BillLineRow {
  id: number
  bill_id: number
  item_id: number
  variant_id: number | null
  qty: number
  unit_id: number
  rate_snapshot: number
  line_discount: number
  line_total: number
  sort_order: number
}

export interface BillWithCustomer extends BillRow {
  customer_name: string | null
  customer_phone: string | null
}

export interface BillLineWithDetail extends BillLineRow {
  item_name: string
  variant_name: string | null
  unit_abbreviation: string
}

export function getNextBillNumber(db: Database.Database): string {
  const prefix = db.prepare("SELECT value FROM settings WHERE key = 'bill_prefix'").get() as { value: string } | undefined
  const seqRow = db.prepare("SELECT value FROM settings WHERE key = 'bill_next_sequence'").get() as { value: string } | undefined
  const pre = prefix ? JSON.parse(prefix.value) : 'BRM'
  const seq = seqRow ? parseInt(seqRow.value) : 1
  return `${pre}-${String(seq).padStart(4, '0')}`
}

function incrementBillSequence(db: Database.Database): void {
  db.prepare(
    "UPDATE settings SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'bill_next_sequence'"
  ).run()
}

export interface CreateBillInput {
  billType: 'sale' | 'processing'
  customerId: number | null
  lines: {
    itemId: number
    variantId: number | null
    qty: number
    unitId: number
    rateSnapshot: number
    lineDiscount: number
    lineTotal: number
    sortOrder: number
  }[]
  discountAmount: number
  paidAmount: number
  paymentMethod: 'cash' | 'bank' | 'digital' | 'credit'
  notes?: string
  operatorId: number
}

export function createBill(db: Database.Database, input: CreateBillInput): { billId: number; billNumber: string } {
  return db.transaction(() => {
    const billNumber = getNextBillNumber(db)
    const subtotal = input.lines.reduce((s, l) => s + l.lineTotal, 0)
    const grandTotal = subtotal - input.discountAmount
    const paidAmount = Math.min(input.paidAmount, grandTotal)
    const dueAmount = grandTotal - paidAmount

    const billRes = db.prepare(
      `INSERT INTO bills
         (bill_number, bill_type, status, customer_id, subtotal, discount_amount,
          taxable_amount, grand_total, paid_amount, due_amount, notes, operator_id)
       VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      billNumber, input.billType, input.customerId,
      subtotal, input.discountAmount, grandTotal,
      grandTotal, paidAmount, dueAmount,
      input.notes ?? null, input.operatorId
    )
    const billId = billRes.lastInsertRowid as number

    for (const line of input.lines) {
      db.prepare(
        `INSERT INTO bill_lines
           (bill_id, item_id, variant_id, qty, unit_id, rate_snapshot,
            line_discount, line_total, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        billId, line.itemId, line.variantId, line.qty, line.unitId,
        line.rateSnapshot, line.lineDiscount, line.lineTotal, line.sortOrder
      )

      // Deduct inventory for each sold line
      db.prepare(
        `INSERT INTO inventory_transactions
           (item_id, variant_id, unit_id, qty_delta, category, tx_type, reference_id, reference_type, operator_id)
         VALUES (?, ?, ?, ?, ?, 'sale', ?, 'bill', ?)`
      ).run(
        line.itemId, line.variantId, line.unitId,
        -line.qty,
        'finished',
        billId, input.operatorId
      )
    }

    if (input.paidAmount > 0) {
      db.prepare(
        `INSERT INTO payments (bill_id, customer_id, amount, method, operator_id)
         VALUES (?, ?, ?, ?, ?)`
      ).run(billId, input.customerId, paidAmount, input.paymentMethod, input.operatorId)
    }

    incrementBillSequence(db)
    return { billId, billNumber }
  })()
}

export function getBills(db: Database.Database, limit = 50): BillWithCustomer[] {
  return db.prepare(
    `SELECT b.*, c.name as customer_name, c.phone as customer_phone
     FROM bills b
     LEFT JOIN customers c ON c.id = b.customer_id
     WHERE b.status != 'cancelled'
     ORDER BY b.created_at DESC
     LIMIT ?`
  ).all(limit) as BillWithCustomer[]
}

export function getBillById(db: Database.Database, id: number): BillWithCustomer | undefined {
  return db.prepare(
    `SELECT b.*, c.name as customer_name, c.phone as customer_phone
     FROM bills b LEFT JOIN customers c ON c.id = b.customer_id
     WHERE b.id = ?`
  ).get(id) as BillWithCustomer | undefined
}

export function addPayment(
  db: Database.Database,
  billId: number,
  amount: number,
  method: 'cash' | 'bank' | 'digital' | 'credit',
  operatorId: number
): void {
  db.transaction(() => {
    const bill = getBillById(db, billId)
    if (!bill) throw new Error('Bill not found')
    if (bill.due_amount <= 0) throw new Error('No outstanding balance on this bill')
    const collecting = Math.min(amount, bill.due_amount)

    db.prepare(
      `INSERT INTO payments (bill_id, customer_id, amount, method, operator_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run(billId, bill.customer_id, collecting, method, operatorId)

    db.prepare(
      `UPDATE bills SET paid_amount = paid_amount + ?, due_amount = due_amount - ? WHERE id = ?`
    ).run(collecting, collecting, billId)
  })()
}

export function getBillLines(db: Database.Database, billId: number): BillLineWithDetail[] {
  return db.prepare(
    `SELECT bl.*,
       i.name as item_name,
       v.name as variant_name,
       u.abbreviation as unit_abbreviation
     FROM bill_lines bl
     JOIN items i ON i.id = bl.item_id
     LEFT JOIN variants v ON v.id = bl.variant_id
     JOIN units u ON u.id = bl.unit_id
     WHERE bl.bill_id = ?
     ORDER BY bl.sort_order`
  ).all(billId) as BillLineWithDetail[]
}

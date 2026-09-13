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
  business_id: number
  business_name: string
  customer_name: string | null
  customer_phone: string | null
}

export interface BillLineWithDetail extends BillLineRow {
  item_name: string
  variant_name: string | null
  unit_abbreviation: string
}

export function getNextBillNumber(db: Database.Database, businessId: number): string {
  const biz = db.prepare(
    'SELECT bill_prefix, bill_next_sequence FROM businesses WHERE id = ?'
  ).get(businessId) as { bill_prefix: string; bill_next_sequence: number } | undefined
  if (!biz) throw new Error('Business not found')
  return `${biz.bill_prefix}-${String(biz.bill_next_sequence).padStart(4, '0')}`
}

function incrementBillSequence(db: Database.Database, businessId: number): void {
  db.prepare(
    'UPDATE businesses SET bill_next_sequence = bill_next_sequence + 1 WHERE id = ?'
  ).run(businessId)
}

export interface CreateBillInput {
  businessId: number
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
    const billNumber = getNextBillNumber(db, input.businessId)
    const subtotal = input.lines.reduce((s, l) => s + l.lineTotal, 0)
    const grandTotal = subtotal - input.discountAmount
    const paidAmount = Math.min(input.paidAmount, grandTotal)
    const dueAmount = grandTotal - paidAmount

    const billRes = db.prepare(
      `INSERT INTO bills
         (bill_number, bill_type, status, customer_id, subtotal, discount_amount,
          taxable_amount, grand_total, paid_amount, due_amount, notes, operator_id, business_id)
       VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      billNumber, input.billType, input.customerId,
      subtotal, input.discountAmount, grandTotal,
      grandTotal, paidAmount, dueAmount,
      input.notes ?? null, input.operatorId, input.businessId
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

    incrementBillSequence(db, input.businessId)
    return { billId, billNumber }
  })()
}

export function getBills(db: Database.Database, limit = 50, businessId?: number): BillWithCustomer[] {
  const where = businessId
    ? `WHERE b.status != 'cancelled' AND b.business_id = ${businessId}`
    : `WHERE b.status != 'cancelled'`
  return db.prepare(
    `SELECT b.*, biz.name as business_name, c.name as customer_name, c.phone as customer_phone
     FROM bills b
     JOIN businesses biz ON biz.id = b.business_id
     LEFT JOIN customers c ON c.id = b.customer_id
     ${where}
     ORDER BY b.created_at DESC
     LIMIT ?`
  ).all(limit) as BillWithCustomer[]
}

export function getBillById(db: Database.Database, id: number): BillWithCustomer | undefined {
  return db.prepare(
    `SELECT b.*, biz.name as business_name, c.name as customer_name, c.phone as customer_phone
     FROM bills b
     JOIN businesses biz ON biz.id = b.business_id
     LEFT JOIN customers c ON c.id = b.customer_id
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

export interface PaymentRow {
  id: number
  bill_id: number
  customer_id: number | null
  amount: number
  method: string
  reference: string | null
  notes: string | null
  operator_id: number
  created_at: string
}

export interface CustomerStatementEntry {
  entry_type: 'sale_line' | 'payment'
  created_at: string
  bill_id: number
  bill_number: string
  business_name: string
  description: string
  debit: number
  credit: number
}

export function getPaymentsByBillId(db: Database.Database, billId: number): PaymentRow[] {
  return db.prepare(
    `SELECT * FROM payments WHERE bill_id = ? ORDER BY created_at ASC`
  ).all(billId) as PaymentRow[]
}

export function cancelBill(
  db: Database.Database,
  billId: number,
  reason: string,
  operatorId: number
): void {
  db.transaction(() => {
    const bill = getBillById(db, billId)
    if (!bill) throw new Error('Bill not found')
    if (bill.status === 'cancelled') throw new Error('Bill is already cancelled')

    const lines = getBillLines(db, billId)
    for (const line of lines) {
      db.prepare(
        `INSERT INTO inventory_transactions
           (item_id, variant_id, unit_id, qty_delta, category, tx_type, reference_id, reference_type, operator_id)
         VALUES (?, ?, ?, ?, 'finished', 'cancellation', ?, 'bill', ?)`
      ).run(line.item_id, line.variant_id, line.unit_id, line.qty, billId, operatorId)
    }

    db.prepare(
      `UPDATE bills
       SET status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = datetime('now')
       WHERE id = ?`
    ).run(reason, operatorId, billId)
  })()
}

export function getCustomerStatement(
  db: Database.Database,
  customerId: number,
  businessId?: number
): CustomerStatementEntry[] {
  const bizFilter = businessId ? `AND b.business_id = ${businessId}` : ''

  const saleLines = db.prepare(
    `SELECT
       'sale_line' as entry_type,
       b.created_at,
       b.id as bill_id,
       b.bill_number,
       biz.name as business_name,
       (i.name ||
         CASE WHEN v.name IS NOT NULL AND v.name != i.name THEN ' (' || v.name || ')' ELSE '' END ||
         ' ' || CAST(CAST(bl.qty AS REAL) AS TEXT) || u.abbreviation ||
         ' × Rs.' || CAST(CAST(bl.rate_snapshot AS REAL) AS TEXT)) as description,
       bl.line_total as debit,
       0 as credit
     FROM bill_lines bl
     JOIN bills b ON b.id = bl.bill_id
     JOIN businesses biz ON biz.id = b.business_id
     JOIN items i ON i.id = bl.item_id
     LEFT JOIN variants v ON v.id = bl.variant_id
     JOIN units u ON u.id = bl.unit_id
     WHERE b.customer_id = ? AND b.status != 'cancelled' ${bizFilter}
     ORDER BY b.created_at ASC, bl.sort_order ASC`
  ).all(customerId) as CustomerStatementEntry[]

  const payments = db.prepare(
    `SELECT
       'payment' as entry_type,
       p.created_at,
       p.bill_id,
       b.bill_number,
       biz.name as business_name,
       ('Payment (' || p.method || ')') as description,
       0 as debit,
       p.amount as credit
     FROM payments p
     JOIN bills b ON b.id = p.bill_id
     JOIN businesses biz ON biz.id = b.business_id
     WHERE p.customer_id = ? ${bizFilter}
     ORDER BY p.created_at ASC`
  ).all(customerId) as CustomerStatementEntry[]

  return [...saleLines, ...payments].sort((a, b) =>
    a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
  )
}

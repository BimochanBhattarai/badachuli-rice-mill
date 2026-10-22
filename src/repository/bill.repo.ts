import Database from 'better-sqlite3'
import { appendEntry, getEntriesForBill, type LedgerEntryView } from './ledger.repo'

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
  /**
   * Cash taken at the counter when this bill was created. An IMMUTABLE historical fact
   * about this one transaction — never updated afterwards, never summed into a balance.
   */
  paid_amount: number
  /** The portion of this bill that went to credit. Also immutable. */
  credit_amount: number
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
  line_type: 'sale' | 'processing'
}

export interface BillWithCustomer extends BillRow {
  business_id: number
  business_name: string
  customer_name: string | null
  customer_phone: string | null
  bill_kind: 'sale' | 'processing' | 'mixed'
  amends_bill_number: string | null
  superseded_by_bill_number: string | null
  /** Balance before this bill. NULL for walk-ins / a customer's first transaction. */
  khata_prev_balance: number | null
  /** Balance after this bill. NULL for walk-ins — omit the khata block entirely then. */
  khata_new_balance: number | null
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
    lineType: 'sale' | 'processing'
  }[]
  discountAmount: number
  paidAmount: number
  paymentMethod: 'cash' | 'bank' | 'digital' | 'credit'
  notes?: string
  operatorId: number
  amendsBillId?: number | null
}

export function createBill(db: Database.Database, input: CreateBillInput): { billId: number; billNumber: string } {
  return db.transaction(() => {
    const billNumber = getNextBillNumber(db, input.businessId)
    const subtotal = input.lines.reduce((s, l) => s + l.lineTotal, 0)
    const grandTotal = subtotal - input.discountAmount
    const paidAmount = Math.min(input.paidAmount, grandTotal)
    const creditAmount = grandTotal - paidAmount

    // A walk-in bill writes no ledger row, so credit on it could never be collected.
    if (!input.customerId && creditAmount > 0.005) {
      throw new Error('A bill with no customer must be paid in full — credit requires a customer')
    }

    const types = new Set(
      input.lines.map(l => l.lineType).filter((t): t is 'sale' | 'processing' => t === 'sale' || t === 'processing')
    )
    const billType: 'sale' | 'processing' = types.size > 0 ? [...types][0] : 'sale'

    const billRes = db.prepare(
      `INSERT INTO bills
         (bill_number, bill_type, status, customer_id, subtotal, discount_amount,
          taxable_amount, grand_total, paid_amount, credit_amount, notes, operator_id, business_id,
          amends_bill_id)
       VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      billNumber, billType, input.customerId,
      subtotal, input.discountAmount, grandTotal,
      grandTotal, paidAmount, creditAmount,
      input.notes ?? null, input.operatorId, input.businessId,
      input.amendsBillId ?? null
    )
    const billId = billRes.lastInsertRowid as number

    for (const line of input.lines) {
      db.prepare(
        `INSERT INTO bill_lines
           (bill_id, item_id, variant_id, qty, unit_id, rate_snapshot,
            line_discount, line_total, sort_order, line_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        billId, line.itemId, line.variantId, line.qty, line.unitId,
        line.rateSnapshot, line.lineDiscount, line.lineTotal, line.sortOrder,
        line.lineType
      )

      db.prepare(
        `INSERT INTO inventory_transactions
           (item_id, variant_id, unit_id, qty_delta, category, tx_type, reference_id, reference_type, operator_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'bill', ?)`
      ).run(
        line.itemId, line.variantId, line.unitId,
        -line.qty,
        'finished',
        line.lineType === 'processing' ? 'processing_in' : 'sale',
        billId, input.operatorId
      )
    }

    // Ledger. Walk-in bills (no customer) never touch a balance.
    // A bill writes the full sale as a debit, then the counter cash as a separate credit,
    // so the ledger shows both what was sold and what was collected.
    if (input.customerId) {
      appendEntry(db, {
        customerId: input.customerId,
        kind: 'sale',
        amount: grandTotal,
        billId,
        businessId: input.businessId,
        note: billNumber,
        operatorId: input.operatorId,
      })

      if (paidAmount > 0) {
        appendEntry(db, {
          customerId: input.customerId,
          kind: 'payment',
          amount: -paidAmount,
          billId,
          businessId: input.businessId,
          method: input.paymentMethod,
          operatorId: input.operatorId,
        })
      }
    }

    incrementBillSequence(db, input.businessId)
    return { billId, billNumber }
  })()
}

const BILL_KIND_EXPR = `CASE WHEN (SELECT COUNT(DISTINCT line_type) FROM bill_lines WHERE bill_id = b.id) > 1 THEN 'mixed' ELSE b.bill_type END`
const AMENDS_NUMBER_EXPR = `(SELECT o.bill_number FROM bills o WHERE o.id = b.amends_bill_id)`
const SUPERSEDED_BY_EXPR = `(SELECT bn.bill_number FROM bills bn WHERE bn.amends_bill_id = b.id)`

/**
 * Khata figures for the receipt, read off the bill's own ledger rows.
 *
 * These are historically frozen: `balance_after` was written once, when the bill was
 * created, so a reprint six months later shows the SAME previous/new balance as the
 * original slip rather than today's. That is the entire reason balance_after is stored.
 *
 * Both are NULL for walk-in bills (no ledger rows); KHATA_PREV is also NULL for a
 * customer's very first transaction and should be coalesced to 0 at render time.
 */
const KHATA_PREV_EXPR = `(
  SELECT p.balance_after FROM customer_ledger p
   WHERE p.customer_id = b.customer_id
     AND p.id < (SELECT MIN(s.id) FROM customer_ledger s
                  WHERE s.bill_id = b.id AND s.kind = 'sale')
   ORDER BY p.id DESC LIMIT 1)`

const KHATA_NEW_EXPR = `(
  SELECT n.balance_after FROM customer_ledger n
   WHERE n.bill_id = b.id AND n.kind IN ('sale', 'payment')
   ORDER BY n.id DESC LIMIT 1)`

export function getBills(
  db: Database.Database,
  limit = 50,
  businessId?: number,
  fromDate?: string,
  toDate?: string,
): BillWithCustomer[] {
  const conds: string[] = []
  const params: (string | number)[] = []
  if (businessId) { conds.push('b.business_id = ?'); params.push(businessId) }
  if (fromDate)   { conds.push('b.created_at >= ?'); params.push(fromDate) }
  if (toDate)     { conds.push('b.created_at < ?');  params.push(toDate) }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : ''
  const baseSQL = `SELECT b.*, biz.name as business_name, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, c.pan_number as customer_pan,
            ${BILL_KIND_EXPR} as bill_kind,
            ${AMENDS_NUMBER_EXPR} as amends_bill_number,
            ${SUPERSEDED_BY_EXPR} as superseded_by_bill_number,
            ${KHATA_PREV_EXPR} as khata_prev_balance,
            ${KHATA_NEW_EXPR} as khata_new_balance
     FROM bills b
     JOIN businesses biz ON biz.id = b.business_id
     LEFT JOIN customers c ON c.id = b.customer_id
     ${where}
     ORDER BY b.created_at DESC`
  if (fromDate && toDate) {
    return db.prepare(baseSQL).all(...params) as BillWithCustomer[]
  }
  return db.prepare(baseSQL + ' LIMIT ?').all(...params, limit) as BillWithCustomer[]
}

export function getBillById(db: Database.Database, id: number): BillWithCustomer | undefined {
  return db.prepare(
    `SELECT b.*, biz.name as business_name, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, c.pan_number as customer_pan,
            ${BILL_KIND_EXPR} as bill_kind,
            ${AMENDS_NUMBER_EXPR} as amends_bill_number,
            ${SUPERSEDED_BY_EXPR} as superseded_by_bill_number,
            ${KHATA_PREV_EXPR} as khata_prev_balance,
            ${KHATA_NEW_EXPR} as khata_new_balance
     FROM bills b
     JOIN businesses biz ON biz.id = b.business_id
     LEFT JOIN customers c ON c.id = b.customer_id
     WHERE b.id = ?`
  ).get(id) as BillWithCustomer | undefined
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

export interface CustomerStatementEntry {
  id: number
  kind: 'opening' | 'sale' | 'payment' | 'loan' | 'loan_repayment' | 'cancel_reversal' | 'adjustment'
  entry_date: string
  created_at: string
  bill_id: number | null
  bill_number: string | null
  business_name: string | null
  description: string
  debit: number
  credit: number
  /** Server-computed running balance (ledger.balance_after). Never recomputed client-side. */
  balance: number
  method: string | null
}

/** Ledger rows this bill produced. Replaces the old per-bill `payments` lookup. */
export function getBillLedgerEntries(db: Database.Database, billId: number): LedgerEntryView[] {
  return getEntriesForBill(db, billId) as LedgerEntryView[]
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

    // Never delete money history — append reversals instead.
    //
    // Reverse EVERY row this bill produced: the sale AND the cash taken at the counter.
    // Reversing only the sale breaks the amendment flow (cancel + recreate), which is
    // how this app edits a bill:
    //   bill 850 paid 850, cancelled -> recreated as 770 paid 770
    //   sale-only reversal: -850 then (+770 -770) = -850  <- phantom 850 credit
    //   full reversal:  (-850 +850) then (+770 -770) = 0  <- correct
    // If the mill keeps the cash instead of refunding it, that is a NEW payment, not a
    // leftover of a cancelled bill.
    //
    // Only rows carrying this bill_id are reversed, which by INVARIANT P means the sale
    // and at-creation payments only. Later debt collection has bill_id = NULL and is
    // therefore never clawed back.
    if (bill.customer_id) {
      const already = db
        .prepare(
          `SELECT COUNT(*) AS n FROM customer_ledger
            WHERE bill_id = ? AND kind = 'cancel_reversal'`
        )
        .get(billId) as { n: number }
      if (already.n > 0) throw new Error('Bill ledger entries are already reversed')

      for (const entry of getEntriesForBill(db, billId)) {
        if (entry.kind === 'cancel_reversal') continue
        appendEntry(db, {
          customerId: bill.customer_id,
          kind: 'cancel_reversal',
          amount: -entry.amount,
          billId,
          businessId: bill.business_id,
          method: entry.method,
          note: `Cancelled ${bill.bill_number}: ${reason}`,
          operatorId,
          reversedOf: entry.id,
        })
      }
    }

    db.prepare(
      `UPDATE bills
       SET status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = datetime('now')
       WHERE id = ?`
    ).run(reason, operatorId, billId)
  })()
}

/**
 * Customer statement, oldest first, straight off the ledger.
 *
 * Replaces the six-query UNION that used to be sorted in JS by a lexicographic
 * `created_at` compare (nondeterministic for same-second rows, and the running balance
 * was re-accumulated client-side starting from zero).
 *
 * There is deliberately NO business filter: the balance is a single global figure per
 * customer, so filtering rows out would make `balance` meaningless. `business_name` is
 * still returned for display.
 */
export function getCustomerStatement(
  db: Database.Database,
  customerId: number
): CustomerStatementEntry[] {
  return db.prepare(
    `SELECT
       cl.id,
       cl.kind,
       cl.entry_date,
       cl.created_at,
       cl.bill_id,
       b.bill_number,
       biz.name AS business_name,
       CASE cl.kind
         WHEN 'opening'         THEN 'Opening Balance'
         WHEN 'sale'            THEN COALESCE('Bill ' || b.bill_number, 'Sale')
         WHEN 'payment'         THEN 'Payment' || COALESCE(' (' || cl.method || ')', '')
         WHEN 'loan'            THEN 'Loan' || COALESCE(' — ' || cl.note, '')
         WHEN 'loan_repayment'  THEN 'Loan repayment' || COALESCE(' (' || cl.method || ')', '')
         WHEN 'cancel_reversal' THEN COALESCE(cl.note, 'Bill cancelled')
         ELSE COALESCE(cl.note, 'Adjustment')
       END AS description,
       CASE WHEN cl.amount > 0 THEN cl.amount  ELSE 0 END AS debit,
       CASE WHEN cl.amount < 0 THEN -cl.amount ELSE 0 END AS credit,
       cl.balance_after AS balance,
       cl.method
     FROM customer_ledger cl
     LEFT JOIN bills b        ON b.id = cl.bill_id
     LEFT JOIN businesses biz ON biz.id = cl.business_id
     WHERE cl.customer_id = ?
     ORDER BY cl.id ASC`
  ).all(customerId) as CustomerStatementEntry[]
}

/**
 * Every item line this customer has ever been billed, newest bill first.
 *
 * The statement above answers "how much money", one row per bill. This answers
 * "what goods", one row per bill line, so a bill that carried 100 kg dhan and
 * 20 kg makai shows up as two rows instead of one.
 *
 * Cancelled bills are excluded (`b.status = 'active'`), matching every other
 * report. Date / item filtering is deliberately left to the caller: one
 * customer's history is small enough to ship whole and filter in the renderer.
 */
export interface CustomerItemLine {
  line_id: number
  bill_id: number
  bill_number: string
  business_name: string | null
  created_at: string
  item_id: number
  item_name: string
  /** raw_material | finished | byproduct | consumable */
  item_category: string
  variant_id: number | null
  variant_name: string | null
  unit_abbreviation: string
  qty: number
  rate_snapshot: number
  line_discount: number
  line_total: number
  line_type: 'sale' | 'processing'
}

export function getCustomerItemLines(
  db: Database.Database,
  customerId: number
): CustomerItemLine[] {
  return db.prepare(
    `SELECT
       bl.id   AS line_id,
       b.id    AS bill_id,
       b.bill_number,
       biz.name AS business_name,
       b.created_at,
       i.id    AS item_id,
       i.name  AS item_name,
       i.category AS item_category,
       v.id    AS variant_id,
       v.name  AS variant_name,
       u.abbreviation AS unit_abbreviation,
       bl.qty,
       bl.rate_snapshot,
       bl.line_discount,
       bl.line_total,
       bl.line_type
     FROM bill_lines bl
     JOIN bills b ON b.id = bl.bill_id
     JOIN items i ON i.id = bl.item_id
     JOIN units u ON u.id = bl.unit_id
     LEFT JOIN variants v     ON v.id = bl.variant_id
     LEFT JOIN businesses biz ON biz.id = b.business_id
     WHERE b.customer_id = ? AND b.status = 'active'
     ORDER BY b.created_at DESC, b.id DESC, bl.sort_order`
  ).all(customerId) as CustomerItemLine[]
}

import Database from 'better-sqlite3'

/**
 * Customer ledger — the single source of truth for customer balances.
 *
 * Sign convention: amount > 0 = customer owes (Dr.), amount < 0 = credit (Cr.).
 *
 * EVERY mutation of a customer balance must go through appendEntry(). It is the only
 * place `customers.balance` is written, which is what keeps the invariant
 * `customers.balance == SUM(customer_ledger.amount)` true by construction.
 *
 * Ordering: balances accumulate strictly in `id` order. Never order by `created_at` —
 * it is UTC with second granularity and live data contains same-second collisions.
 */

export type LedgerKind =
  | 'opening'
  | 'sale'
  | 'payment'
  | 'loan'
  | 'loan_repayment'
  | 'cancel_reversal'
  | 'adjustment'

export interface LedgerEntryInput {
  customerId: number
  kind: LedgerKind
  /** Signed. Positive = customer owes more, negative = customer owes less. */
  amount: number
  billId?: number | null
  loanId?: number | null
  /** Display metadata only — never used to compute a balance. */
  businessId?: number | null
  method?: string | null
  note?: string | null
  operatorId?: number | null
  reversedOf?: number | null
  /** Business/display date. Defaults to today. Does NOT affect ordering. */
  entryDate?: string | null
}

export interface LedgerRow {
  id: number
  customer_id: number
  kind: LedgerKind
  amount: number
  balance_after: number
  bill_id: number | null
  loan_id: number | null
  business_id: number | null
  method: string | null
  note: string | null
  operator_id: number | null
  reversed_of: number | null
  entry_date: string
  created_at: string
}

export interface LedgerEntryView extends LedgerRow {
  bill_number: string | null
  business_name: string | null
}

/** Round to 2dp, half away from zero (symmetric for negative amounts). */
export function round2(n: number): number {
  const sign = n < 0 ? -1 : 1
  return (sign * Math.round(Math.abs(n) * 100)) / 100
}

/**
 * Append one ledger row and move `customers.balance` by the same amount, atomically.
 *
 * Uses an IMMEDIATE transaction so the read-balance -> insert -> update sequence takes
 * the write lock up front and cannot interleave. When called from inside an existing
 * transaction (e.g. createBill), better-sqlite3 nests this as a SAVEPOINT.
 *
 * @returns the new ledger row's id
 */
export function appendEntry(db: Database.Database, input: LedgerEntryInput): number {
  if (!input.customerId) {
    throw new Error('ledger: customerId is required (walk-in sales must not write a ledger row)')
  }
  if (!Number.isFinite(input.amount)) {
    throw new Error('ledger: amount must be a finite number')
  }

  const amount = round2(input.amount)

  return db.transaction(() => {
    const row = db
      .prepare('SELECT balance FROM customers WHERE id = ?')
      .get(input.customerId) as { balance: number } | undefined

    if (!row) throw new Error(`ledger: customer ${input.customerId} not found`)

    const balanceAfter = round2(row.balance + amount)

    const info = db
      .prepare(
        `INSERT INTO customer_ledger
           (customer_id, kind, amount, balance_after, bill_id, loan_id, business_id,
            method, note, operator_id, reversed_of, entry_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, date('now')))`
      )
      .run(
        input.customerId,
        input.kind,
        amount,
        balanceAfter,
        input.billId ?? null,
        input.loanId ?? null,
        input.businessId ?? null,
        input.method ?? null,
        input.note ?? null,
        input.operatorId ?? null,
        input.reversedOf ?? null,
        input.entryDate ?? null
      )

    db.prepare('UPDATE customers SET balance = ? WHERE id = ?').run(balanceAfter, input.customerId)

    return Number(info.lastInsertRowid)
  }).immediate()
}

export function getBalance(db: Database.Database, customerId: number): number {
  const row = db.prepare('SELECT balance FROM customers WHERE id = ?').get(customerId) as
    | { balance: number }
    | undefined
  return row ? round2(row.balance) : 0
}

/**
 * Full ledger for one customer, oldest first. Ordered by `id` so it matches the order
 * `balance_after` was accumulated in.
 */
export function getLedger(db: Database.Database, customerId: number): LedgerEntryView[] {
  return db
    .prepare(
      `SELECT cl.*, b.bill_number, biz.name AS business_name
         FROM customer_ledger cl
         LEFT JOIN bills b      ON b.id = cl.bill_id
         LEFT JOIN businesses biz ON biz.id = cl.business_id
        WHERE cl.customer_id = ?
        ORDER BY cl.id ASC`
    )
    .all(customerId) as LedgerEntryView[]
}

/** The ledger rows a bill produced, oldest first. Used for historically-accurate reprints. */
export function getEntriesForBill(db: Database.Database, billId: number): LedgerRow[] {
  return db
    .prepare('SELECT * FROM customer_ledger WHERE bill_id = ? ORDER BY id ASC')
    .all(billId) as LedgerRow[]
}

export interface IntegrityProblem {
  customer_id: number
  stored_balance: number
  ledger_sum: number
  last_balance_after: number
}

/**
 * Asserts the ledger invariants:
 *   1. customers.balance == SUM(customer_ledger.amount)
 *   2. the last row's balance_after == that same sum
 * Returns the offending customers; an empty array means the ledger is sound.
 */
export function verifyIntegrity(db: Database.Database): IntegrityProblem[] {
  return db
    .prepare(
      `SELECT c.id AS customer_id,
              ROUND(c.balance, 2) AS stored_balance,
              ROUND(COALESCE(l.total, 0), 2) AS ledger_sum,
              ROUND(COALESCE(l.last_after, 0), 2) AS last_balance_after
         FROM customers c
         LEFT JOIN (
           SELECT customer_id,
                  SUM(amount) AS total,
                  (SELECT balance_after FROM customer_ledger x
                    WHERE x.customer_id = cl.customer_id
                    ORDER BY x.id DESC LIMIT 1) AS last_after
             FROM customer_ledger cl
            GROUP BY customer_id
         ) l ON l.customer_id = c.id
        WHERE ABS(ROUND(c.balance, 2) - ROUND(COALESCE(l.total, 0), 2)) > 0.005
           OR ABS(ROUND(c.balance, 2) - ROUND(COALESCE(l.last_after, 0), 2)) > 0.005`
    )
    .all() as IntegrityProblem[]
}

export interface CashCollected {
  /** Cash taken at the counter when a bill was created (includes walk-ins). */
  counter: number
  /** Debt collected later, against the running balance. Not attributable to a business. */
  debt: number
  total: number
}

/**
 * Cash actually received in a date range (inclusive), counted once.
 *
 * Two disjoint sources, kept apart by INVARIANT P (a payment row carries a bill_id
 * if and only if it was taken at that bill's creation):
 *   counter -> bills.paid_amount
 *   debt    -> ledger payment rows with bill_id IS NULL
 * Summing both the bills table and all ledger payments would double-count counter cash.
 *
 * `businessId` scopes the counter term only. A debt payment settles one global customer
 * balance and has no business, so it is excluded entirely when a business is selected
 * rather than being arbitrarily attributed to one.
 */
export function getCashCollected(
  db: Database.Database,
  fromDate: string,
  toDate: string,
  businessId?: number
): CashCollected {
  const counterRow = db
    .prepare(
      `SELECT COALESCE(SUM(paid_amount), 0) AS v FROM bills
        WHERE status = 'active'
          AND DATE(created_at) BETWEEN ? AND ?
          ${businessId ? 'AND business_id = ?' : ''}`
    )
    .get(...(businessId ? [fromDate, toDate, businessId] : [fromDate, toDate])) as { v: number }

  const debtRow = businessId
    ? { v: 0 }
    : (db
        .prepare(
          `SELECT COALESCE(-SUM(amount), 0) AS v FROM customer_ledger
            WHERE kind IN ('payment', 'loan_repayment')
              AND bill_id IS NULL
              AND DATE(created_at) BETWEEN ? AND ?`
        )
        .get(fromDate, toDate) as { v: number })

  const counter = round2(counterRow.v)
  const debt = round2(debtRow.v)
  return { counter, debt, total: round2(counter + debt) }
}

/**
 * Shared SQL fragments for the customer summary figures.
 *
 * Defined once so the customer list, search, detail and the Reports balance table cannot
 * drift apart. They are built so that, for every customer and by construction:
 *
 *     CHARGES - PAID == customers.balance
 *
 * CHARGES is every ledger row that is not money received: the opening khata balance,
 * sales, loans, adjustments, and cancellations (negative, correctly reducing charges).
 * Without the opening balance in here the figures cannot reconcile on screen -- 100 of
 * 152 customers carry one, and it is most of what they owe.
 *
 * PAID counts only money actually received. A cancelled bill must never read as a
 * payment, which is what `-SUM(amount) WHERE amount < 0` would have done.
 */
export const LEDGER_CHARGES_SQL = `
  COALESCE((SELECT SUM(amount) FROM customer_ledger
             WHERE customer_id = c.id
               AND kind NOT IN ('payment', 'loan_repayment')), 0)`

export const LEDGER_PAID_SQL = `
  COALESCE((SELECT -SUM(amount) FROM customer_ledger
             WHERE customer_id = c.id
               AND kind IN ('payment', 'loan_repayment')), 0)`

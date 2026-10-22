import Database from 'better-sqlite3'
import { appendEntry, round2, LEDGER_CHARGES_SQL, LEDGER_PAID_SQL } from './ledger.repo'

export interface CustomerRow {
  id: number
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  pan_number: string | null
  /** Immutable khata-import figure. Kept for history; NOT the live balance. */
  opening_balance: number
  /** The one central running balance. Positive = owes (Dr.), negative = credit (Cr.). */
  balance: number
  is_active: number
  created_at: string
}

export interface CustomerWithBalance extends CustomerRow {
  total_billed: number
  total_paid: number
  outstanding: number
}

export function getAllCustomers(db: Database.Database, activeOnly = true): CustomerWithBalance[] {
  const where = activeOnly ? 'WHERE c.is_active = 1' : ''
  return db.prepare(
    `SELECT c.*,
       ${LEDGER_CHARGES_SQL} AS total_billed,
       ${LEDGER_PAID_SQL} AS total_paid,
       c.balance AS outstanding
     FROM customers c
     ${where}
     ORDER BY c.name`
  ).all() as CustomerWithBalance[]
}

export function searchCustomers(db: Database.Database, query: string): CustomerWithBalance[] {
  const pattern = `%${query}%`
  return db.prepare(
    `SELECT c.*,
       ${LEDGER_CHARGES_SQL} AS total_billed,
       ${LEDGER_PAID_SQL} AS total_paid,
       c.balance AS outstanding
     FROM customers c
     WHERE c.is_active = 1 AND (c.name LIKE ? OR c.phone LIKE ?)
     ORDER BY c.name
     LIMIT 30`
  ).all(pattern, pattern) as CustomerWithBalance[]
}

export function getCustomerById(db: Database.Database, id: number): CustomerWithBalance | undefined {
  return db.prepare(
    `SELECT c.*,
       ${LEDGER_CHARGES_SQL} AS total_billed,
       ${LEDGER_PAID_SQL} AS total_paid,
       c.balance AS outstanding
     FROM customers c
     WHERE c.id = ?`
  ).get(id) as CustomerWithBalance | undefined
}

export function createCustomer(
  db: Database.Database,
  name: string,
  phone?: string,
  address?: string,
  notes?: string,
  panNumber?: string
): number {
  const result = db.prepare(
    'INSERT INTO customers (name, phone, address, notes, pan_number) VALUES (?, ?, ?, ?, ?)'
  ).run(name, phone ?? null, address ?? null, notes ?? null, panNumber ?? null)
  return result.lastInsertRowid as number
}

export function updateCustomer(
  db: Database.Database,
  id: number,
  name: string,
  phone?: string,
  address?: string,
  notes?: string,
  panNumber?: string
): void {
  db.prepare(
    'UPDATE customers SET name = ?, phone = ?, address = ?, notes = ?, pan_number = ? WHERE id = ?'
  ).run(name, phone ?? null, address ?? null, notes ?? null, panNumber ?? null, id)
}

export function deactivateCustomer(db: Database.Database, id: number): void {
  db.prepare('UPDATE customers SET is_active = 0 WHERE id = ?').run(id)
}

export function restoreCustomer(db: Database.Database, id: number): void {
  db.prepare('UPDATE customers SET is_active = 1 WHERE id = ?').run(id)
}

/**
 * Receive money from a customer.
 *
 * Balance-forward: the payment is ONE signed ledger row. It is never allocated across
 * individual bills or loans. If the amount exceeds what the customer owes, the balance
 * simply goes negative (credit) — overpayment and "advance" are the same operation.
 */
export function receivePayment(
  db: Database.Database,
  customerId: number,
  amount: number,
  method: 'cash' | 'bank' | 'digital',
  operatorId: number,
  note?: string | null
): void {
  const amt = round2(amount)
  if (!(amt > 0)) throw new Error('Payment amount must be greater than zero')

  appendEntry(db, {
    customerId,
    kind: 'payment',
    amount: -amt,
    method,
    note: note ?? null,
    operatorId,
  })
}

/**
 * Adjust a customer's balance by an arbitrary signed amount (corrections only).
 * Positive increases what the customer owes, negative reduces it.
 */
export function adjustBalance(
  db: Database.Database,
  customerId: number,
  signedAmount: number,
  operatorId: number,
  note: string
): void {
  const amt = round2(signedAmount)
  if (amt === 0) throw new Error('Adjustment amount must be non-zero')

  appendEntry(db, {
    customerId,
    kind: 'adjustment',
    amount: amt,
    note,
    operatorId,
  })
}

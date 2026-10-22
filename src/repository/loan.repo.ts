import Database from 'better-sqlite3'
import { appendEntry, round2 } from './ledger.repo'

export interface CustomerLoanRow {
  id: number
  customer_id: number
  customer_name: string
  amount: number
  /**
   * Frozen historical fields. A loan now posts straight to the customer's running
   * balance, so these are NOT a live outstanding figure — never display them as one.
   */
  paid_amount: number
  due_amount: number
  description: string | null
  loan_date: string
  status: 'active' | 'cancelled'
  operator_id: number
  created_at: string
}

export function createLoan(
  db: Database.Database,
  customerId: number,
  amount: number,
  operatorId: number,
  description?: string,
  loanDate?: string
): number {
  const amt = round2(amount)
  if (!(amt > 0)) throw new Error('Loan amount must be greater than zero')

  const date = loanDate ?? new Date().toISOString().slice(0, 10)

  return db.transaction(() => {
    const result = db.prepare(
      `INSERT INTO customer_loans (customer_id, amount, due_amount, description, loan_date, operator_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(customerId, amt, amt, description ?? null, date, operatorId)

    const loanId = Number(result.lastInsertRowid)

    // Loans fold into the single running balance, tagged so the ledger still
    // distinguishes cash lent from goods sold. `entryDate` carries a backdated
    // loan_date for display; posting order (id) remains binding for the balance chain.
    appendEntry(db, {
      customerId,
      kind: 'loan',
      amount: amt,
      loanId,
      note: description ?? null,
      operatorId,
      entryDate: date,
    })

    return loanId
  }).immediate()
}

export function getLoansByCustomer(
  db: Database.Database,
  customerId: number
): CustomerLoanRow[] {
  return db.prepare(
    `SELECT cl.*, c.name AS customer_name
     FROM customer_loans cl
     JOIN customers c ON c.id = cl.customer_id
     WHERE cl.customer_id = ?
     ORDER BY cl.loan_date DESC, cl.created_at DESC`
  ).all(customerId) as CustomerLoanRow[]
}

export function getAllLoans(db: Database.Database): CustomerLoanRow[] {
  return db.prepare(
    `SELECT cl.*, c.name AS customer_name
     FROM customer_loans cl
     JOIN customers c ON c.id = cl.customer_id
     ORDER BY cl.loan_date DESC, cl.created_at DESC`
  ).all() as CustomerLoanRow[]
}

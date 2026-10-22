import Database from 'better-sqlite3'

export interface EmployeeRow {
  id: number
  name: string
  phone: string | null
  position: string | null
  base_salary: number
  is_active: number
  created_at: string
}

export interface SalaryPaymentRow {
  id: number
  employee_id: number
  employee_name: string
  amount: number
  txn_type: 'salary' | 'advance' | 'bonus' | 'deduction'
  description: string | null
  paid_date: string
  cycle_id: number | null
  operator_id: number
  created_at: string
}

export interface EmployeeLoanRow {
  id: number
  employee_id: number
  amount: number
  paid_amount: number
  due_amount: number
  description: string | null
  loan_date: string
  status: 'active' | 'cancelled'
  operator_id: number
  created_at: string
}

export interface EmployeeRemaining {
  base_salary: number
  total_deducted: number
  remaining: number
}

// ── Employees ─────────────────────────────────────────────────────────────────

export function getAllEmployees(db: Database.Database, activeOnly = true): EmployeeRow[] {
  const where = activeOnly ? 'WHERE is_active = 1' : ''
  return db.prepare(`SELECT * FROM employees ${where} ORDER BY name`).all() as EmployeeRow[]
}

export function createEmployee(
  db: Database.Database,
  name: string,
  phone?: string,
  position?: string,
  baseSalary = 0
): number {
  const result = db.prepare(
    `INSERT INTO employees (name, phone, position, base_salary) VALUES (?, ?, ?, ?)`
  ).run(name, phone ?? null, position ?? null, baseSalary)
  return result.lastInsertRowid as number
}

export function updateEmployee(
  db: Database.Database,
  id: number,
  name: string,
  phone?: string,
  position?: string,
  baseSalary?: number
): void {
  if (baseSalary !== undefined) {
    db.prepare(
      `UPDATE employees SET name = ?, phone = ?, position = ?, base_salary = ? WHERE id = ?`
    ).run(name, phone ?? null, position ?? null, baseSalary, id)
  } else {
    db.prepare(
      `UPDATE employees SET name = ?, phone = ?, position = ? WHERE id = ?`
    ).run(name, phone ?? null, position ?? null, id)
  }
}

export function deactivateEmployee(db: Database.Database, id: number): void {
  db.prepare(`UPDATE employees SET is_active = 0 WHERE id = ?`).run(id)
}

// ── Salary payments ────────────────────────────────────────────────────────────

export function recordSalaryPayment(
  db: Database.Database,
  employeeId: number,
  amount: number,
  txnType: 'salary' | 'advance' | 'bonus' | 'deduction',
  operatorId: number,
  description?: string,
  paidDate?: string
): number {
  const result = db.prepare(
    `INSERT INTO salary_payments (employee_id, amount, txn_type, description, paid_date, operator_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    employeeId,
    amount,
    txnType,
    description ?? null,
    paidDate ?? new Date().toISOString().slice(0, 10),
    operatorId
  )
  return result.lastInsertRowid as number
}

export function deleteSalaryPayment(db: Database.Database, id: number): void {
  db.prepare(`DELETE FROM salary_payments WHERE id = ?`).run(id)
}

export function getSalaryPayments(
  db: Database.Database,
  employeeId: number
): SalaryPaymentRow[] {
  return db.prepare(
    `SELECT sp.*, e.name AS employee_name
     FROM salary_payments sp
     JOIN employees e ON e.id = sp.employee_id
     WHERE sp.employee_id = ?
     ORDER BY sp.paid_date DESC, sp.created_at DESC`
  ).all(employeeId) as SalaryPaymentRow[]
}

// ── Remaining salary calculation ──────────────────────────────────────────────
// remaining = base_salary − SUM(advance + deduction since the last salary payment)

export function getEmployeeRemaining(
  db: Database.Database,
  employeeId: number
): EmployeeRemaining {
  const emp = db.prepare(
    `SELECT base_salary FROM employees WHERE id = ?`
  ).get(employeeId) as { base_salary: number } | undefined

  const baseSalary = emp?.base_salary ?? 0
  if (baseSalary <= 0) return { base_salary: 0, total_deducted: 0, remaining: 0 }

  const { last_id } = db.prepare(
    `SELECT COALESCE(MAX(id), 0) AS last_id
     FROM salary_payments
     WHERE employee_id = ? AND txn_type = 'salary'`
  ).get(employeeId) as { last_id: number }

  const { total_deducted } = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS total_deducted
     FROM salary_payments
     WHERE employee_id = ? AND txn_type IN ('advance', 'deduction') AND id > ?`
  ).get(employeeId, last_id) as { total_deducted: number }

  const remaining = Math.max(0, baseSalary - total_deducted)
  return { base_salary: baseSalary, total_deducted, remaining }
}

export function payRemainingSalary(
  db: Database.Database,
  employeeId: number,
  operatorId: number
): { paid: number } {
  const { remaining } = getEmployeeRemaining(db, employeeId)
  if (remaining > 0.005) {
    db.prepare(
      `INSERT INTO salary_payments (employee_id, amount, txn_type, description, paid_date, operator_id)
       VALUES (?, ?, 'salary', 'Salary payment', date('now'), ?)`
    ).run(employeeId, remaining, operatorId)
  }
  return { paid: remaining }
}

// ── Employee loans ────────────────────────────────────────────────────────────

export function getEmployeeLoans(
  db: Database.Database,
  employeeId: number
): EmployeeLoanRow[] {
  return db.prepare(
    `SELECT * FROM employee_loans WHERE employee_id = ? ORDER BY loan_date DESC, created_at DESC`
  ).all(employeeId) as EmployeeLoanRow[]
}

export function createEmployeeLoan(
  db: Database.Database,
  employeeId: number,
  amount: number,
  operatorId: number,
  description?: string,
  loanDate?: string
): number {
  const result = db.prepare(
    `INSERT INTO employee_loans (employee_id, amount, due_amount, description, loan_date, operator_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    employeeId,
    amount,
    amount,
    description ?? null,
    loanDate ?? new Date().toISOString().slice(0, 10),
    operatorId
  )
  return result.lastInsertRowid as number
}

// Edit an existing loan's principal, description and date. The outstanding
// (due_amount) is recomputed as amount − paid_amount so any repayments already
// recorded stay intact. The new principal cannot drop below what has already
// been repaid.
export function updateEmployeeLoan(
  db: Database.Database,
  loanId: number,
  employeeId: number,
  amount: number,
  operatorId: number,
  description?: string,
  loanDate?: string
): void {
  db.transaction(() => {
    const loan = db.prepare(
      `SELECT paid_amount FROM employee_loans WHERE id = ? AND employee_id = ?`
    ).get(loanId, employeeId) as { paid_amount: number } | undefined

    if (!loan) throw new Error('Loan not found')
    if (amount < loan.paid_amount - 0.005) {
      throw new Error('Amount cannot be less than what has already been repaid')
    }

    db.prepare(
      `UPDATE employee_loans
         SET amount = ?, due_amount = ?, description = ?, loan_date = COALESCE(?, loan_date)
       WHERE id = ? AND employee_id = ?`
    ).run(amount, amount - loan.paid_amount, description ?? null, loanDate ?? null, loanId, employeeId)
  })()
}

export function recordLoanRepayment(
  db: Database.Database,
  loanId: number,
  employeeId: number,
  amount: number,
  operatorId: number,
  paidDate?: string
): void {
  const date = paidDate ?? new Date().toISOString().slice(0, 10)
  db.transaction(() => {
    const loan = db.prepare(
      `SELECT due_amount FROM employee_loans WHERE id = ? AND employee_id = ?`
    ).get(loanId, employeeId) as { due_amount: number } | undefined

    if (!loan) throw new Error('Loan not found')
    if (loan.due_amount < amount - 0.005) throw new Error('Repayment exceeds outstanding balance')

    db.prepare(
      `INSERT INTO employee_loan_payments (loan_id, employee_id, amount, paid_date, operator_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run(loanId, employeeId, amount, date, operatorId)

    db.prepare(
      `UPDATE employee_loans SET paid_amount = paid_amount + ?, due_amount = due_amount - ? WHERE id = ?`
    ).run(amount, amount, loanId)

    db.prepare(
      `INSERT INTO salary_payments (employee_id, amount, txn_type, description, paid_date, operator_id)
       VALUES (?, ?, 'deduction', 'Loan repayment', ?, ?)`
    ).run(employeeId, amount, date, operatorId)
  })()
}

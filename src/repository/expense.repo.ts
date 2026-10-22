import Database from 'better-sqlite3'

export interface ExpenseCategoryRow {
  id: number
  name: string
  is_active: number
}

export interface ExpenseRow {
  id: number
  category_id: number
  category_name: string
  amount: number
  description: string | null
  expense_date: string
  operator_id: number
  created_at: string
}

export function getExpenseCategories(db: Database.Database): ExpenseCategoryRow[] {
  return db.prepare(
    `SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY name`
  ).all() as ExpenseCategoryRow[]
}

export function createExpenseCategory(db: Database.Database, name: string): number {
  const result = db.prepare(
    `INSERT INTO expense_categories (name) VALUES (?)`
  ).run(name)
  return result.lastInsertRowid as number
}

export function getExpenses(
  db: Database.Database,
  fromDate?: string,
  toDate?: string
): ExpenseRow[] {
  const where =
    fromDate && toDate
      ? `WHERE e.expense_date BETWEEN '${fromDate}' AND '${toDate}'`
      : fromDate
        ? `WHERE e.expense_date >= '${fromDate}'`
        : ''
  return db.prepare(
    `SELECT e.*, ec.name AS category_name
     FROM expenses e
     JOIN expense_categories ec ON ec.id = e.category_id
     ${where}
     ORDER BY e.expense_date DESC, e.created_at DESC`
  ).all() as ExpenseRow[]
}

export function createExpense(
  db: Database.Database,
  categoryId: number,
  amount: number,
  operatorId: number,
  description?: string,
  expenseDate?: string
): number {
  const result = db.prepare(
    `INSERT INTO expenses (category_id, amount, description, expense_date, operator_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    categoryId,
    amount,
    description ?? null,
    expenseDate ?? new Date().toISOString().slice(0, 10),
    operatorId
  )
  return result.lastInsertRowid as number
}

export function updateExpense(
  db: Database.Database,
  id: number,
  categoryId: number,
  amount: number,
  description: string | null,
  expenseDate: string
): void {
  db.prepare(
    `UPDATE expenses SET category_id = ?, amount = ?, description = ?, expense_date = ? WHERE id = ?`
  ).run(categoryId, amount, description, expenseDate, id)
}

export function deleteExpense(db: Database.Database, id: number): void {
  db.prepare(`DELETE FROM expenses WHERE id = ?`).run(id)
}

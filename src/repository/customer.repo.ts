import Database from 'better-sqlite3'

export interface CustomerRow {
  id: number
  name: string
  phone: string | null
  address: string | null
  notes: string | null
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
       COALESCE(SUM(b.grand_total), 0) AS total_billed,
       COALESCE(SUM(b.paid_amount), 0) AS total_paid,
       COALESCE(SUM(b.due_amount),  0) AS outstanding
     FROM customers c
     LEFT JOIN bills b ON b.customer_id = c.id AND b.status = 'active'
     ${where}
     GROUP BY c.id
     ORDER BY c.name`
  ).all() as CustomerWithBalance[]
}

export function searchCustomers(db: Database.Database, query: string): CustomerWithBalance[] {
  const pattern = `%${query}%`
  return db.prepare(
    `SELECT c.*,
       COALESCE(SUM(b.grand_total), 0) AS total_billed,
       COALESCE(SUM(b.paid_amount), 0) AS total_paid,
       COALESCE(SUM(b.due_amount),  0) AS outstanding
     FROM customers c
     LEFT JOIN bills b ON b.customer_id = c.id AND b.status = 'active'
     WHERE c.is_active = 1 AND (c.name LIKE ? OR c.phone LIKE ?)
     GROUP BY c.id
     ORDER BY c.name
     LIMIT 30`
  ).all(pattern, pattern) as CustomerWithBalance[]
}

export function getCustomerById(db: Database.Database, id: number): CustomerWithBalance | undefined {
  return db.prepare(
    `SELECT c.*,
       COALESCE(SUM(b.grand_total), 0) AS total_billed,
       COALESCE(SUM(b.paid_amount), 0) AS total_paid,
       COALESCE(SUM(b.due_amount),  0) AS outstanding
     FROM customers c
     LEFT JOIN bills b ON b.customer_id = c.id AND b.status = 'active'
     WHERE c.id = ?
     GROUP BY c.id`
  ).get(id) as CustomerWithBalance | undefined
}

export function createCustomer(
  db: Database.Database,
  name: string,
  phone?: string,
  address?: string,
  notes?: string
): number {
  const result = db.prepare(
    'INSERT INTO customers (name, phone, address, notes) VALUES (?, ?, ?, ?)'
  ).run(name, phone ?? null, address ?? null, notes ?? null)
  return result.lastInsertRowid as number
}

export function updateCustomer(
  db: Database.Database,
  id: number,
  name: string,
  phone?: string,
  address?: string,
  notes?: string
): void {
  db.prepare(
    'UPDATE customers SET name = ?, phone = ?, address = ?, notes = ? WHERE id = ?'
  ).run(name, phone ?? null, address ?? null, notes ?? null, id)
}

export function deactivateCustomer(db: Database.Database, id: number): void {
  db.prepare('UPDATE customers SET is_active = 0 WHERE id = ?').run(id)
}

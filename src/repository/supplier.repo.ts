import Database from 'better-sqlite3'

export interface SupplierRow {
  id: number
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  is_active: number
  created_at: string
}

export function getAllSuppliers(db: Database.Database, activeOnly = true): SupplierRow[] {
  const sql = activeOnly
    ? 'SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name'
    : 'SELECT * FROM suppliers ORDER BY name'
  return db.prepare(sql).all() as SupplierRow[]
}

export function searchSuppliers(db: Database.Database, query: string): SupplierRow[] {
  return db.prepare(
    `SELECT * FROM suppliers WHERE is_active = 1
     AND (name LIKE ? OR phone LIKE ?)
     ORDER BY name LIMIT 20`
  ).all(`%${query}%`, `%${query}%`) as SupplierRow[]
}

export function createSupplier(
  db: Database.Database,
  name: string,
  phone?: string,
  address?: string,
  notes?: string
): number {
  const res = db.prepare(
    `INSERT INTO suppliers (name, phone, address, notes) VALUES (?, ?, ?, ?)`
  ).run(name.trim(), phone ?? null, address ?? null, notes ?? null)
  return res.lastInsertRowid as number
}

export function updateSupplier(
  db: Database.Database,
  id: number,
  name: string,
  phone?: string,
  address?: string,
  notes?: string
): void {
  db.prepare(
    `UPDATE suppliers SET name = ?, phone = ?, address = ?, notes = ? WHERE id = ?`
  ).run(name.trim(), phone ?? null, address ?? null, notes ?? null, id)
}

export function deactivateSupplier(db: Database.Database, id: number): void {
  db.prepare('UPDATE suppliers SET is_active = 0 WHERE id = ?').run(id)
}

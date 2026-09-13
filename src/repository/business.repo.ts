import Database from 'better-sqlite3'

export interface BusinessRow {
  id: number
  name: string
  pan_number: string | null
  phone: string | null
  address: string | null
  bill_prefix: string
  bill_next_sequence: number
}

export function getAllBusinesses(db: Database.Database): BusinessRow[] {
  return db.prepare('SELECT * FROM businesses ORDER BY id').all() as BusinessRow[]
}

export function getBusinessById(db: Database.Database, id: number): BusinessRow | undefined {
  return db.prepare('SELECT * FROM businesses WHERE id = ?').get(id) as BusinessRow | undefined
}

export function createBusiness(
  db: Database.Database,
  fields: { name: string; pan_number?: string; phone?: string; address?: string; bill_prefix: string }
): number {
  const result = db.prepare(
    `INSERT INTO businesses (name, pan_number, phone, address, bill_prefix, bill_next_sequence)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).run(
    fields.name,
    fields.pan_number?.trim() || null,
    fields.phone?.trim() || null,
    fields.address?.trim() || null,
    fields.bill_prefix.trim().toUpperCase()
  )
  return result.lastInsertRowid as number
}

export function deleteBusiness(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM businesses WHERE id = ?').run(id)
}

export function updateBusiness(
  db: Database.Database,
  id: number,
  fields: { name: string; pan_number?: string; phone?: string; address?: string; bill_prefix: string }
): void {
  db.prepare(
    `UPDATE businesses
     SET name = ?, pan_number = ?, phone = ?, address = ?, bill_prefix = ?
     WHERE id = ?`
  ).run(
    fields.name,
    fields.pan_number?.trim() || null,
    fields.phone?.trim() || null,
    fields.address?.trim() || null,
    fields.bill_prefix.trim().toUpperCase(),
    id
  )
}

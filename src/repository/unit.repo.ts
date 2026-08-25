import Database from 'better-sqlite3'

export interface UnitRow {
  id: number
  name: string
  abbreviation: string
  base_factor: number
  is_default: number
}

export function getAllUnits(db: Database.Database): UnitRow[] {
  return db.prepare('SELECT * FROM units ORDER BY is_default DESC, name').all() as UnitRow[]
}

export function getDefaultUnit(db: Database.Database): UnitRow | undefined {
  return db.prepare('SELECT * FROM units WHERE is_default = 1 LIMIT 1').get() as UnitRow | undefined
}

export function setDefaultUnit(db: Database.Database, id: number): void {
  db.transaction(() => {
    db.prepare('UPDATE units SET is_default = 0').run()
    db.prepare('UPDATE units SET is_default = 1 WHERE id = ?').run(id)
  })()
}

export function getUnitById(db: Database.Database, id: number): UnitRow | undefined {
  return db.prepare('SELECT * FROM units WHERE id = ?').get(id) as UnitRow | undefined
}

export function createUnit(
  db: Database.Database,
  name: string,
  abbreviation: string,
  baseFactor: number
): number {
  const result = db
    .prepare('INSERT INTO units (name, abbreviation, base_factor) VALUES (?, ?, ?)')
    .run(name, abbreviation, baseFactor)
  return result.lastInsertRowid as number
}

export function updateUnit(
  db: Database.Database,
  id: number,
  name: string,
  abbreviation: string,
  baseFactor: number
): void {
  db.prepare('UPDATE units SET name = ?, abbreviation = ?, base_factor = ? WHERE id = ?').run(
    name,
    abbreviation,
    baseFactor,
    id
  )
}

export function deleteUnit(db: Database.Database, id: number): boolean {
  const inUse = db
    .prepare(
      `SELECT 1 FROM items WHERE default_unit_id = ?
       UNION SELECT 1 FROM prices WHERE unit_id = ?
       UNION SELECT 1 FROM inventory_transactions WHERE unit_id = ?
       LIMIT 1`
    )
    .get(id, id, id)
  if (inUse) return false
  db.prepare('DELETE FROM units WHERE id = ?').run(id)
  return true
}

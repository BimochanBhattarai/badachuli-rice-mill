import Database from 'better-sqlite3'

export interface ItemRow {
  id: number
  name: string
  category: 'raw_material' | 'finished' | 'byproduct' | 'consumable'
  default_unit_id: number
  is_active: number
  created_at: string
}

export interface ItemWithUnit extends ItemRow {
  unit_name: string
  unit_abbreviation: string
}

export function getAllItems(db: Database.Database, activeOnly = true): ItemWithUnit[] {
  const where = activeOnly ? 'WHERE i.is_active = 1' : ''
  return db
    .prepare(
      `SELECT i.*, u.name as unit_name, u.abbreviation as unit_abbreviation
       FROM items i
       JOIN units u ON u.id = i.default_unit_id
       ${where}
       ORDER BY i.name`
    )
    .all() as ItemWithUnit[]
}

export function getItemById(db: Database.Database, id: number): ItemWithUnit | undefined {
  return db
    .prepare(
      `SELECT i.*, u.name as unit_name, u.abbreviation as unit_abbreviation
       FROM items i
       JOIN units u ON u.id = i.default_unit_id
       WHERE i.id = ?`
    )
    .get(id) as ItemWithUnit | undefined
}

export function searchItems(
  db: Database.Database,
  query: string,
  category?: string
): ItemWithUnit[] {
  const pattern = `%${query}%`
  if (category) {
    return db
      .prepare(
        `SELECT i.*, u.name as unit_name, u.abbreviation as unit_abbreviation
         FROM items i JOIN units u ON u.id = i.default_unit_id
         WHERE i.is_active = 1 AND i.name LIKE ? AND i.category = ?
         ORDER BY i.name LIMIT 50`
      )
      .all(pattern, category) as ItemWithUnit[]
  }
  return db
    .prepare(
      `SELECT i.*, u.name as unit_name, u.abbreviation as unit_abbreviation
       FROM items i JOIN units u ON u.id = i.default_unit_id
       WHERE i.is_active = 1 AND i.name LIKE ?
       ORDER BY i.name LIMIT 50`
    )
    .all(pattern) as ItemWithUnit[]
}

export function createItem(
  db: Database.Database,
  name: string,
  category: ItemRow['category'],
  defaultUnitId: number
): number {
  const result = db
    .prepare('INSERT INTO items (name, category, default_unit_id) VALUES (?, ?, ?)')
    .run(name, category, defaultUnitId)
  return result.lastInsertRowid as number
}

export function updateItem(
  db: Database.Database,
  id: number,
  name: string,
  category: ItemRow['category'],
  defaultUnitId: number
): void {
  db.prepare('UPDATE items SET name = ?, category = ?, default_unit_id = ? WHERE id = ?').run(
    name,
    category,
    defaultUnitId,
    id
  )
}

export function deactivateItem(db: Database.Database, id: number): void {
  db.prepare('UPDATE items SET is_active = 0 WHERE id = ?').run(id)
}

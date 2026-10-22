import Database from 'better-sqlite3'

export interface VariantRow {
  id: number
  item_id: number
  name: string
  is_default: number
  is_active: number
  priority: number | null
}

export interface ArchivedVariantRow extends VariantRow {
  item_name: string
}

export function getVariantsByItem(db: Database.Database, itemId: number): VariantRow[] {
  return db
    .prepare('SELECT * FROM variants WHERE item_id = ? ORDER BY COALESCE(priority, 999999), is_default DESC, name')
    .all(itemId) as VariantRow[]
}

export function getArchivedVariants(db: Database.Database): ArchivedVariantRow[] {
  return db.prepare(
    `SELECT v.*, i.name as item_name
     FROM variants v JOIN items i ON i.id = v.item_id
     WHERE v.is_active = 0
     ORDER BY i.name, v.name`
  ).all() as ArchivedVariantRow[]
}

export function restoreVariant(db: Database.Database, id: number): void {
  db.prepare('UPDATE variants SET is_active = 1 WHERE id = ?').run(id)
}

export function setVariantPriority(db: Database.Database, id: number, priority: number | null): void {
  db.prepare('UPDATE variants SET priority = ? WHERE id = ?').run(priority, id)
}

export function getVariantById(db: Database.Database, id: number): VariantRow | undefined {
  return db.prepare('SELECT * FROM variants WHERE id = ?').get(id) as VariantRow | undefined
}

export function createVariant(
  db: Database.Database,
  itemId: number,
  name: string,
  isDefault: boolean
): number {
  return db.transaction(() => {
    if (isDefault) {
      db.prepare('UPDATE variants SET is_default = 0 WHERE item_id = ?').run(itemId)
    }
    const result = db
      .prepare('INSERT INTO variants (item_id, name, is_default) VALUES (?, ?, ?)')
      .run(itemId, name, isDefault ? 1 : 0)
    return result.lastInsertRowid as number
  })()
}

export function updateVariant(
  db: Database.Database,
  id: number,
  name: string,
  isDefault: boolean
): void {
  db.transaction(() => {
    const variant = db
      .prepare('SELECT item_id FROM variants WHERE id = ?')
      .get(id) as { item_id: number } | undefined
    if (!variant) return
    if (isDefault) {
      db.prepare('UPDATE variants SET is_default = 0 WHERE item_id = ?').run(variant.item_id)
    }
    db.prepare('UPDATE variants SET name = ?, is_default = ? WHERE id = ?').run(
      name,
      isDefault ? 1 : 0,
      id
    )
  })()
}

export function deactivateVariant(db: Database.Database, id: number): void {
  db.prepare('UPDATE variants SET is_active = 0 WHERE id = ?').run(id)
}

export function ensureDefaultVariant(db: Database.Database, itemId: number): void {
  const hasDefault = db
    .prepare('SELECT 1 FROM variants WHERE item_id = ? AND is_default = 1 AND is_active = 1')
    .get(itemId)
  if (!hasDefault) {
    const first = db
      .prepare('SELECT id FROM variants WHERE item_id = ? AND is_active = 1 ORDER BY id LIMIT 1')
      .get(itemId) as { id: number } | undefined
    if (first) {
      db.prepare('UPDATE variants SET is_default = 1 WHERE id = ?').run(first.id)
    }
  }
}

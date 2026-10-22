import Database from 'better-sqlite3'

export interface ItemRow {
  id: number
  name: string
  category: 'raw_material' | 'finished' | 'byproduct' | 'consumable'
  default_unit_id: number
  is_active: number
  is_buyable: number
  is_sellable: number
  is_processable: number
  enable_token: number
  created_at: string
  priority: number | null
}

export interface ItemWithUnit extends ItemRow {
  unit_name: string
  unit_abbreviation: string
}

// Derives the inventory category from purpose flags for use in inventory_transactions
export function deriveCategory(
  isBuyable: boolean,
  isSellable: boolean,
  isProcessable: boolean
): ItemRow['category'] {
  if (isBuyable && isProcessable) return 'raw_material'
  if (isSellable && !isBuyable) return 'finished'
  if (isBuyable && !isProcessable) return 'consumable'
  return 'raw_material'
}

export function getAllItems(db: Database.Database, activeOnly = true): ItemWithUnit[] {
  const where = activeOnly ? 'WHERE i.is_active = 1' : ''
  return db
    .prepare(
      `SELECT i.*, u.name as unit_name, u.abbreviation as unit_abbreviation
       FROM items i
       JOIN units u ON u.id = i.default_unit_id
       ${where}
       ORDER BY COALESCE(i.priority, 999999), i.name`
    )
    .all() as ItemWithUnit[]
}

export function getItemById(db: Database.Database, id: number): ItemWithUnit | undefined {
  return db
    .prepare(
      `SELECT i.*, u.name as unit_name, u.abbreviation as unit_abbreviation
       FROM items i JOIN units u ON u.id = i.default_unit_id
       WHERE i.id = ?`
    )
    .get(id) as ItemWithUnit | undefined
}

export function searchItems(
  db: Database.Database,
  query: string,
  filter?: { sellable?: boolean; buyable?: boolean; processable?: boolean; stockable?: boolean }
): ItemWithUnit[] {
  const pattern = `%${query}%`
  const conditions: string[] = ['i.is_active = 1', 'i.name LIKE ?']
  if (filter?.stockable) conditions.push('(i.is_buyable = 1 OR i.is_sellable = 1)')
  else {
    if (filter?.sellable)    conditions.push('i.is_sellable = 1')
    if (filter?.buyable)     conditions.push('i.is_buyable = 1')
    if (filter?.processable) conditions.push('i.is_processable = 1')
  }
  const where = conditions.join(' AND ')
  return db
    .prepare(
      `SELECT i.*, u.name as unit_name, u.abbreviation as unit_abbreviation
       FROM items i JOIN units u ON u.id = i.default_unit_id
       WHERE ${where}
       ORDER BY COALESCE(i.priority, 999999), i.name LIMIT 50`
    )
    .all(pattern) as ItemWithUnit[]
}

export function createItem(
  db: Database.Database,
  name: string,
  defaultUnitId: number,
  isBuyable: boolean,
  isSellable: boolean,
  isProcessable: boolean,
  enableToken: boolean = false
): number {
  const category = deriveCategory(isBuyable, isSellable, isProcessable)
  const result = db
    .prepare(
      `INSERT INTO items (name, category, default_unit_id, is_buyable, is_sellable, is_processable, enable_token)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, category, defaultUnitId, isBuyable ? 1 : 0, isSellable ? 1 : 0, isProcessable ? 1 : 0, enableToken ? 1 : 0)
  return result.lastInsertRowid as number
}

export function updateItem(
  db: Database.Database,
  id: number,
  name: string,
  defaultUnitId: number,
  isBuyable: boolean,
  isSellable: boolean,
  isProcessable: boolean,
  enableToken: boolean = false
): void {
  const category = deriveCategory(isBuyable, isSellable, isProcessable)
  db.prepare(
    `UPDATE items
     SET name = ?, category = ?, default_unit_id = ?,
         is_buyable = ?, is_sellable = ?, is_processable = ?, enable_token = ?
     WHERE id = ?`
  ).run(name, category, defaultUnitId, isBuyable ? 1 : 0, isSellable ? 1 : 0, isProcessable ? 1 : 0, enableToken ? 1 : 0, id)
}

export function setItemPriority(db: Database.Database, id: number, priority: number | null): void {
  db.prepare('UPDATE items SET priority = ? WHERE id = ?').run(priority, id)
}

export function deactivateItem(db: Database.Database, id: number): void {
  db.prepare('UPDATE items SET is_active = 0 WHERE id = ?').run(id)
}

export function restoreItem(db: Database.Database, id: number): void {
  db.prepare('UPDATE items SET is_active = 1 WHERE id = ?').run(id)
}

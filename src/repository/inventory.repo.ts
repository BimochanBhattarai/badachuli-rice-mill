import Database from 'better-sqlite3'

export interface StockLevel {
  item_id: number
  item_name: string
  item_category: string
  variant_id: number | null
  variant_name: string | null
  unit_id: number
  unit_abbreviation: string
  balance: number
}

export interface InventoryTxRow {
  id: number
  item_id: number
  variant_id: number | null
  unit_id: number
  qty_delta: number
  category: string
  tx_type: string
  reference_id: number | null
  reference_type: string | null
  notes: string | null
  operator_id: number
  created_at: string
}

export function getAllStockLevels(db: Database.Database): StockLevel[] {
  return db
    .prepare(
      `SELECT
         i.id   AS item_id,
         i.name AS item_name,
         i.category AS item_category,
         v.id   AS variant_id,
         v.name AS variant_name,
         u.id   AS unit_id,
         u.abbreviation AS unit_abbreviation,
         SUM(it.qty_delta) AS balance
       FROM inventory_transactions it
       JOIN  items i ON i.id = it.item_id
       LEFT JOIN variants v ON v.id = it.variant_id
       JOIN  units u ON u.id = it.unit_id
       WHERE i.is_active = 1
         AND (i.is_buyable = 1 OR i.is_sellable = 1)
       GROUP BY it.item_id, it.variant_id, it.unit_id
       ORDER BY i.name, v.name`
    )
    .all() as StockLevel[]
}

export function getItemStockLevels(db: Database.Database, itemId: number): StockLevel[] {
  return db
    .prepare(
      `SELECT
         i.id   AS item_id,
         i.name AS item_name,
         i.category AS item_category,
         v.id   AS variant_id,
         v.name AS variant_name,
         u.id   AS unit_id,
         u.abbreviation AS unit_abbreviation,
         SUM(it.qty_delta) AS balance
       FROM inventory_transactions it
       JOIN  items i ON i.id = it.item_id
       LEFT JOIN variants v ON v.id = it.variant_id
       JOIN  units u ON u.id = it.unit_id
       WHERE it.item_id = ?
       GROUP BY it.item_id, it.variant_id, it.unit_id`
    )
    .all(itemId) as StockLevel[]
}

export function adjustStock(
  db: Database.Database,
  itemId: number,
  variantId: number | null,
  unitId: number,
  newQty: number,
  operatorId: number,
  notes?: string
): void {
  const row = db.prepare(
    `SELECT COALESCE(SUM(qty_delta), 0) AS balance
     FROM inventory_transactions
     WHERE item_id = ? AND variant_id IS ? AND unit_id = ?`
  ).get(itemId, variantId, unitId) as { balance: number }

  const delta = newQty - (row.balance ?? 0)
  if (delta === 0) return

  const item = db.prepare('SELECT is_sellable FROM items WHERE id = ?').get(itemId) as
    { is_sellable: number } | undefined
  const category = item?.is_sellable ? 'finished' : 'raw_material'

  addInventoryTransaction(db, itemId, variantId, unitId, delta, category, 'adjustment', operatorId, notes)
}

export function addInventoryTransaction(
  db: Database.Database,
  itemId: number,
  variantId: number | null,
  unitId: number,
  qtyDelta: number,
  category: string,
  txType: string,
  operatorId: number,
  notes?: string,
  referenceId?: number,
  referenceType?: string
): number {
  const result = db
    .prepare(
      `INSERT INTO inventory_transactions
         (item_id, variant_id, unit_id, qty_delta, category, tx_type,
          operator_id, notes, reference_id, reference_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      itemId,
      variantId ?? null,
      unitId,
      qtyDelta,
      category,
      txType,
      operatorId,
      notes ?? null,
      referenceId ?? null,
      referenceType ?? null
    )
  return result.lastInsertRowid as number
}

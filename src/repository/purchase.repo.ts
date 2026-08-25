import Database from 'better-sqlite3'

export interface PurchaseLineInput {
  itemId: number
  variantId: number | null
  qty: number
  unitId: number
  rate: number
  lineTotal: number
}

export interface CreatePurchaseInput {
  supplierId: number
  lines: PurchaseLineInput[]
  notes?: string
  operatorId: number
}

export interface PurchaseOrderRow {
  id: number
  supplier_id: number
  status: string
  notes: string | null
  operator_id: number
  created_at: string
}

export interface PurchaseWithSupplier extends PurchaseOrderRow {
  supplier_name: string
  supplier_phone: string | null
  total_amount: number
  line_count: number
}

export interface PurchaseLineWithDetail {
  id: number
  order_id: number
  item_id: number
  variant_id: number | null
  qty: number
  unit_id: number
  rate: number
  line_total: number
  item_name: string
  variant_name: string | null
  unit_abbreviation: string
}

function itemCategory(
  db: Database.Database,
  itemId: number
): 'raw_material' | 'finished' | 'byproduct' | 'consumable' {
  const item = db.prepare(
    'SELECT is_buyable, is_processable FROM items WHERE id = ?'
  ).get(itemId) as { is_buyable: number; is_processable: number } | undefined
  if (!item) return 'raw_material'
  if (item.is_buyable && item.is_processable) return 'raw_material'
  return 'consumable'
}

export function createPurchase(
  db: Database.Database,
  input: CreatePurchaseInput
): { orderId: number } {
  return db.transaction(() => {
    const orderRes = db.prepare(
      `INSERT INTO purchase_orders (supplier_id, notes, operator_id)
       VALUES (?, ?, ?)`
    ).run(input.supplierId, input.notes ?? null, input.operatorId)
    const orderId = orderRes.lastInsertRowid as number

    const lineStmt = db.prepare(
      `INSERT INTO purchase_lines (order_id, item_id, variant_id, qty, unit_id, rate, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const invStmt = db.prepare(
      `INSERT INTO inventory_transactions
         (item_id, variant_id, unit_id, qty_delta, category, tx_type,
          reference_id, reference_type, operator_id)
       VALUES (?, ?, ?, ?, ?, 'purchase', ?, 'purchase_order', ?)`
    )

    for (const line of input.lines) {
      lineStmt.run(
        orderId, line.itemId, line.variantId, line.qty,
        line.unitId, line.rate, line.lineTotal
      )
      const cat = itemCategory(db, line.itemId)
      invStmt.run(
        line.itemId, line.variantId, line.unitId,
        line.qty, cat, orderId, input.operatorId
      )
    }

    return { orderId }
  })()
}

export function getPurchases(db: Database.Database, limit = 50): PurchaseWithSupplier[] {
  return db.prepare(
    `SELECT po.*,
       s.name  as supplier_name,
       s.phone as supplier_phone,
       COALESCE(SUM(pl.line_total), 0) as total_amount,
       COUNT(pl.id) as line_count
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN purchase_lines pl ON pl.order_id = po.id
     WHERE po.status != 'cancelled'
     GROUP BY po.id
     ORDER BY po.created_at DESC
     LIMIT ?`
  ).all(limit) as PurchaseWithSupplier[]
}

export function getPurchaseLines(
  db: Database.Database,
  orderId: number
): PurchaseLineWithDetail[] {
  return db.prepare(
    `SELECT pl.*,
       i.name  as item_name,
       v.name  as variant_name,
       u.abbreviation as unit_abbreviation
     FROM purchase_lines pl
     JOIN items i ON i.id = pl.item_id
     LEFT JOIN variants v ON v.id = pl.variant_id
     JOIN units u ON u.id = pl.unit_id
     WHERE pl.order_id = ?`
  ).all(orderId) as PurchaseLineWithDetail[]
}

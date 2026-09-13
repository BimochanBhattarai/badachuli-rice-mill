import Database from 'better-sqlite3'

export interface PriceRow {
  id: number
  item_id: number
  variant_id: number | null
  unit_id: number
  price: number
  price_type: 'sell' | 'buy' | 'processing'
  effective_from: string
  effective_to: string | null
  created_at: string
}

export interface PriceListEntry {
  item_id: number
  item_name: string
  unit_id: number
  unit_abbr: string
  variant_id: number
  variant_name: string
  price_id: number | null
  price: number | null
  effective_from: string | null
}

export interface CurrentPrice extends PriceRow {
  item_name: string
  variant_name: string | null
  unit_abbreviation: string
}

export function getCurrentPrices(db: Database.Database, itemId: number): CurrentPrice[] {
  return db
    .prepare(
      `SELECT p.*, i.name as item_name, v.name as variant_name, u.abbreviation as unit_abbreviation
       FROM prices p
       JOIN items i ON i.id = p.item_id
       LEFT JOIN variants v ON v.id = p.variant_id
       JOIN units u ON u.id = p.unit_id
       WHERE p.item_id = ? AND p.effective_to IS NULL
       ORDER BY p.price_type, v.name`
    )
    .all(itemId) as CurrentPrice[]
}

export function getPriceHistory(
  db: Database.Database,
  itemId: number,
  variantId: number | null,
  priceType: 'sell' | 'buy'
): PriceRow[] {
  if (variantId !== null) {
    return db
      .prepare(
        `SELECT * FROM prices
         WHERE item_id = ? AND variant_id = ? AND price_type = ?
         ORDER BY effective_from DESC`
      )
      .all(itemId, variantId, priceType) as PriceRow[]
  }
  return db
    .prepare(
      `SELECT * FROM prices
       WHERE item_id = ? AND variant_id IS NULL AND price_type = ?
       ORDER BY effective_from DESC`
    )
    .all(itemId, priceType) as PriceRow[]
}

export function getCurrentPrice(
  db: Database.Database,
  itemId: number,
  variantId: number | null,
  unitId: number,
  priceType: 'sell' | 'buy'
): PriceRow | undefined {
  if (variantId !== null) {
    return db
      .prepare(
        `SELECT * FROM prices
         WHERE item_id = ? AND variant_id = ? AND unit_id = ? AND price_type = ? AND effective_to IS NULL`
      )
      .get(itemId, variantId, unitId, priceType) as PriceRow | undefined
  }
  return db
    .prepare(
      `SELECT * FROM prices
       WHERE item_id = ? AND variant_id IS NULL AND unit_id = ? AND price_type = ? AND effective_to IS NULL`
    )
    .get(itemId, unitId, priceType) as PriceRow | undefined
}

export function getAllCurrentPrices(
  db: Database.Database,
  priceType: 'sell' | 'processing'
): PriceListEntry[] {
  const itemFilter = priceType === 'sell' ? 'i.is_sellable = 1' : 'i.is_processable = 1'
  return db.prepare(
    `SELECT
       i.id        AS item_id,
       i.name      AS item_name,
       i.default_unit_id AS unit_id,
       u.abbreviation    AS unit_abbr,
       v.id        AS variant_id,
       v.name      AS variant_name,
       p.id        AS price_id,
       p.price,
       p.effective_from
     FROM items i
     JOIN units u    ON u.id = i.default_unit_id
     JOIN variants v ON v.item_id = i.id AND v.is_active = 1
     LEFT JOIN prices p
       ON  p.item_id    = i.id
       AND p.variant_id = v.id
       AND p.price_type = ?
       AND p.effective_to IS NULL
     WHERE i.is_active = 1 AND ${itemFilter}
     ORDER BY i.name, v.name`
  ).all(priceType) as PriceListEntry[]
}

export function setPrice(
  db: Database.Database,
  itemId: number,
  variantId: number | null,
  unitId: number,
  price: number,
  priceType: 'sell' | 'buy' | 'processing',
  effectiveFrom: string
): number {
  return db.transaction(() => {
    // Close any existing active price for this combination
    if (variantId !== null) {
      db.prepare(
        `UPDATE prices SET effective_to = ?
         WHERE item_id = ? AND variant_id = ? AND unit_id = ? AND price_type = ? AND effective_to IS NULL`
      ).run(effectiveFrom, itemId, variantId, unitId, priceType)
    } else {
      db.prepare(
        `UPDATE prices SET effective_to = ?
         WHERE item_id = ? AND variant_id IS NULL AND unit_id = ? AND price_type = ? AND effective_to IS NULL`
      ).run(effectiveFrom, itemId, unitId, priceType)
    }

    const result = db
      .prepare(
        `INSERT INTO prices (item_id, variant_id, unit_id, price, price_type, effective_from)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(itemId, variantId, unitId, price, priceType, effectiveFrom)

    return result.lastInsertRowid as number
  })()
}

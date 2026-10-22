import Database from 'better-sqlite3'

export interface TokenRow {
  id: number
  token_number: number
  business_id: number | null
  item_id: number
  operator_id: number | null
  created_at: string
}

// Generate the next daily token. The counter is global (shared across
// businesses) and self-resets each day: MAX(token_number) is scoped to today's
// date, so the first token of every morning restarts at 1. Runs in a
// transaction so the read-max + insert is atomic under concurrent calls.
export function generateToken(
  db: Database.Database,
  businessId: number | null,
  itemId: number,
  operatorId: number,
): { tokenNumber: number; createdAt: string } {
  return db.transaction(() => {
    const row = db.prepare(
      `SELECT COALESCE(MAX(token_number), 0) + 1 AS next
         FROM tokens
        WHERE DATE(created_at) = DATE('now')`
    ).get() as { next: number }
    const tokenNumber = row.next

    const res = db.prepare(
      `INSERT INTO tokens (token_number, business_id, item_id, operator_id)
       VALUES (?, ?, ?, ?)`
    ).run(tokenNumber, businessId, itemId, operatorId)

    const created = db.prepare(
      `SELECT created_at FROM tokens WHERE id = ?`
    ).get(res.lastInsertRowid as number) as { created_at: string }

    return { tokenNumber, createdAt: created.created_at }
  })()
}

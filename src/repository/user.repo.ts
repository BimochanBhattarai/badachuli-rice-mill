import Database from 'better-sqlite3'

export interface UserRow {
  id: number
  username: string
  pin_hash: string
  role: 'owner' | 'operator'
  is_active: number
  created_at: string
}

export function findUserByUsername(db: Database.Database, username: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as
    | UserRow
    | undefined
}

export function createUser(
  db: Database.Database,
  username: string,
  pinHash: string,
  role: 'owner' | 'operator'
): number {
  const result = db
    .prepare('INSERT INTO users (username, pin_hash, role) VALUES (?, ?, ?)')
    .run(username, pinHash, role)
  return result.lastInsertRowid as number
}

export function countUsers(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  return row.count
}

export function updatePinHash(db: Database.Database, userId: number, pinHash: string): void {
  db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(pinHash, userId)
}

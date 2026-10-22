import Database from 'better-sqlite3'

export interface UserRow {
  id: number
  username: string
  pin_hash: string
  role: 'owner' | 'operator'
  is_active: number
  created_at: string
}

export interface PublicUserRow {
  id: number
  username: string
  role: 'owner' | 'operator'
  is_active: number
  created_at: string
}

/**
 * Look up a user for login. Case-insensitive on purpose: the stored username keeps
 * whatever case was typed when the account was made ('Admin', 'Bimochan'), but nobody
 * should have to reproduce that capitalisation to sign in. Migration 0018 adds a
 * matching UNIQUE INDEX ... COLLATE NOCASE, so at most one row can ever match.
 */
export function findUserByUsername(db: Database.Database, username: string): UserRow | undefined {
  return db
    .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE AND is_active = 1')
    .get(username.trim()) as UserRow | undefined
}

export function getAllUsers(db: Database.Database): PublicUserRow[] {
  return db.prepare(
    'SELECT id, username, role, is_active, created_at FROM users ORDER BY created_at ASC'
  ).all() as PublicUserRow[]
}

export function getUserById(db: Database.Database, id: number): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
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

export function setUserActive(db: Database.Database, userId: number, active: boolean): void {
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(active ? 1 : 0, userId)
}

/** Stores the username exactly as typed. Case-insensitive uniqueness is enforced by
 *  the idx_users_username_nocase index from migration 0018. */
export function updateUsername(db: Database.Database, userId: number, newUsername: string): void {
  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername.trim(), userId)
}

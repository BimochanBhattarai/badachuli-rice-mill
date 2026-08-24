import Database from 'better-sqlite3'

export function isFirstRun(db: Database.Database): boolean {
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  return row.count === 0
}

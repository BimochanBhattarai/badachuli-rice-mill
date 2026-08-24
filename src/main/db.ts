import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { runMigrations } from './migrations'

let _db: Database.Database | null = null

export function openDatabase(): Database.Database {
  if (_db) return _db

  const dbPath =
    !app.isPackaged && process.env.NODE_ENV === 'development'
      ? join(process.cwd(), 'dev.db')
      : join(app.getPath('userData'), 'badachuli.db')

  const db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = -32000')   // 32 MB
  db.pragma('mmap_size = 134217728') // 128 MB

  runMigrations(db)

  _db = db
  return db
}

export function getDatabase(): Database.Database {
  if (!_db) throw new Error('Database not initialized. Call openDatabase() first.')
  return _db
}

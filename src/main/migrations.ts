import Database from 'better-sqlite3'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const MIGRATIONS_DIR = join(__dirname, '../../migrations')

export function runMigrations(db: Database.Database): void {
  const currentVersion = (db.pragma('user_version', { simple: true }) as number) ?? 0

  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const pending = migrationFiles.filter((f) => {
    const version = parseInt(f.split('_')[0], 10)
    return version > currentVersion
  })

  if (pending.length === 0) return

  for (const file of pending) {
    const version = parseInt(file.split('_')[0], 10)
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8')

    // The user_version bump MUST be inside the transaction. PRAGMA user_version is
    // journaled like any other page write, so committing it atomically with the DDL
    // means a crash can never leave a migration applied but unrecorded (which would
    // re-run non-idempotent DDL on next boot and hard-fail).
    db.transaction(() => {
      db.exec(sql)
      db.pragma(`user_version = ${version}`)
    })()

    console.log(`[migration] applied ${file}`)
  }
}

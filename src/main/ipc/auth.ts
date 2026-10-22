import { ipcMain } from 'electron'
import { randomBytes } from 'crypto'
import Database from 'better-sqlite3'
import { hashPin, verifyPin, validatePin } from '../../domain/auth'
import {
  findUserByUsername,
  createUser,
  countUsers,
  updatePinHash,
  getUserById,
} from '../../repository/user.repo'
import { writeAuditLog } from '../audit'

interface IpcResult<T = null> {
  ok: boolean
  data?: T
  error?: string
}

function ok<T>(data?: T): IpcResult<T> { return { ok: true, data } }
function fail(message: string): IpcResult { return { ok: false, error: message } }

function generateRecoveryCode(): string {
  const hex = randomBytes(6).toString('hex').toUpperCase()
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`
}

function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  if (!row) return null
  try { return JSON.parse(row.value) } catch { return row.value }
}

function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))').run(key, JSON.stringify(value))
}

export function registerAuthHandlers(db: Database.Database): void {
  ipcMain.handle('auth:isFirstRun', (): IpcResult<boolean> => {
    return ok(countUsers(db) === 0)
  })

  // First-run setup — returns userId AND a one-time recovery code
  ipcMain.handle(
    'auth:setupOwner',
    async (_event, username: string, pin: string): Promise<IpcResult<{ userId: number; recoveryCode: string }>> => {
      if (countUsers(db) > 0) return fail('Setup already completed')
      const pinError = validatePin(pin)
      if (pinError) return fail(pinError)
      if (!username || username.trim().length < 2) return fail('Username must be at least 2 characters')

      const pinHash = await hashPin(pin)
      const userId = createUser(db, username.trim(), pinHash, 'owner')

      // Generate and store recovery code
      const code = generateRecoveryCode()
      const codeHash = await hashPin(code.replace(/-/g, ''))
      setSetting(db, 'recovery_code_hash', codeHash)
      setSetting(db, 'recovery_owner_id', String(userId))

      writeAuditLog(db, 'USER_CREATED', 'users', userId, { username, role: 'owner' }, userId)
      writeAuditLog(db, 'SETUP_COMPLETED', 'system', null, null, userId)

      return ok({ userId, recoveryCode: code })
    }
  )

  // Login
  ipcMain.handle(
    'auth:login',
    async (_event, username: string, pin: string): Promise<IpcResult<{ id: number; username: string; role: string }>> => {
      const user = findUserByUsername(db, username)
      if (!user) {
        writeAuditLog(db, 'LOGIN_FAILED', 'users', null, { username }, null)
        return fail('Invalid username or PIN')
      }
      const valid = await verifyPin(user.pin_hash, pin)
      if (!valid) {
        writeAuditLog(db, 'LOGIN_FAILED', 'users', user.id, { username }, null)
        return fail('Invalid username or PIN')
      }
      writeAuditLog(db, 'LOGIN_SUCCESS', 'users', user.id, null, user.id)
      return ok({ id: user.id, username: user.username, role: user.role })
    }
  )

  // Change PIN (requires current PIN)
  ipcMain.handle(
    'auth:changePin',
    async (_event, userId: number, currentPin: string, newPin: string): Promise<IpcResult> => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as { pin_hash: string } | undefined
      if (!user) return fail('User not found')
      const valid = await verifyPin(user.pin_hash, currentPin)
      if (!valid) return fail('Current PIN is incorrect')
      const pinError = validatePin(newPin)
      if (pinError) return fail(pinError)
      const newHash = await hashPin(newPin)
      updatePinHash(db, userId, newHash)
      writeAuditLog(db, 'PIN_CHANGED', 'users', userId, null, userId)
      return ok()
    }
  )

  // Recover access using recovery code — resets the owner's PIN
  ipcMain.handle(
    'auth:recoverWithCode',
    async (_event, code: string, newPin: string): Promise<IpcResult<{ id: number; username: string; role: string }>> => {
      const storedHash = getSetting(db, 'recovery_code_hash')
      const ownerIdStr = getSetting(db, 'recovery_owner_id')
      if (!storedHash || !ownerIdStr) return fail('No recovery code is configured for this installation.')

      const normalised = code.trim().replace(/-/g, '').toUpperCase()
      if (!normalised) return fail('Recovery code is required')

      const valid = await verifyPin(storedHash, normalised)
      if (!valid) {
        writeAuditLog(db, 'LOGIN_FAILED', 'users', null, { method: 'recovery_code' }, null)
        return fail('Incorrect recovery code')
      }

      const pinError = validatePin(newPin)
      if (pinError) return fail(pinError)

      const ownerId = parseInt(ownerIdStr, 10)
      const owner = getUserById(db, ownerId)
      if (!owner) return fail('Owner account not found')

      const newHash = await hashPin(newPin)
      updatePinHash(db, ownerId, newHash)
      writeAuditLog(db, 'PIN_CHANGED', 'users', ownerId, { method: 'recovery_code' }, ownerId)

      return ok({ id: owner.id, username: owner.username, role: owner.role })
    }
  )

  // Regenerate recovery code (requires current PIN of the requesting user)
  ipcMain.handle(
    'auth:regenerateRecoveryCode',
    async (_event, userId: number, currentPin: string): Promise<IpcResult<{ recoveryCode: string }>> => {
      const user = getUserById(db, userId)
      if (!user) return fail('User not found')
      const valid = await verifyPin(user.pin_hash, currentPin)
      if (!valid) return fail('PIN is incorrect')

      const code = generateRecoveryCode()
      const codeHash = await hashPin(code.replace(/-/g, ''))
      setSetting(db, 'recovery_code_hash', codeHash)
      setSetting(db, 'recovery_owner_id', String(userId))

      writeAuditLog(db, 'PIN_CHANGED', 'users', userId, { method: 'recovery_code_regenerated' }, userId)
      return ok({ recoveryCode: code })
    }
  )
}

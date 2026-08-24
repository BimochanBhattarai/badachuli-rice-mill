import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { hashPin, verifyPin, validatePin } from '../../domain/auth'
import {
  findUserByUsername,
  createUser,
  countUsers,
  updatePinHash
} from '../../repository/user.repo'
import { writeAuditLog } from '../audit'

interface IpcResult<T = null> {
  ok: boolean
  data?: T
  error?: string
}

function ok<T>(data?: T): IpcResult<T> {
  return { ok: true, data }
}

function err(message: string): IpcResult {
  return { ok: false, error: message }
}

export function registerAuthHandlers(db: Database.Database): void {
  // Check if any user exists (drives first-run wizard vs login screen)
  ipcMain.handle('auth:isFirstRun', (): IpcResult<boolean> => {
    return ok(countUsers(db) === 0)
  })

  // First-run: create owner account
  ipcMain.handle(
    'auth:setupOwner',
    async (_event, username: string, pin: string): Promise<IpcResult<{ userId: number }>> => {
      if (countUsers(db) > 0) return err('Setup already completed')

      const pinError = validatePin(pin)
      if (pinError) return err(pinError)

      if (!username || username.trim().length < 2) return err('Username must be at least 2 characters')

      const pinHash = await hashPin(pin)
      const userId = createUser(db, username.trim(), pinHash, 'owner')

      writeAuditLog(db, 'USER_CREATED', 'users', userId, { username, role: 'owner' }, userId)
      writeAuditLog(db, 'SETUP_COMPLETED', 'system', null, null, userId)

      return ok({ userId })
    }
  )

  // Login
  ipcMain.handle(
    'auth:login',
    async (_event, username: string, pin: string): Promise<IpcResult<{ id: number; username: string; role: string }>> => {
      const user = findUserByUsername(db, username)
      if (!user) {
        writeAuditLog(db, 'LOGIN_FAILED', 'users', null, { username }, null)
        return err('Invalid username or PIN')
      }

      const valid = await verifyPin(user.pin_hash, pin)
      if (!valid) {
        writeAuditLog(db, 'LOGIN_FAILED', 'users', user.id, { username }, null)
        return err('Invalid username or PIN')
      }

      writeAuditLog(db, 'LOGIN_SUCCESS', 'users', user.id, null, user.id)
      return ok({ id: user.id, username: user.username, role: user.role })
    }
  )

  // Change PIN
  ipcMain.handle(
    'auth:changePin',
    async (
      _event,
      userId: number,
      currentPin: string,
      newPin: string
    ): Promise<IpcResult> => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as
        | { pin_hash: string }
        | undefined
      if (!user) return err('User not found')

      const valid = await verifyPin(user.pin_hash, currentPin)
      if (!valid) return err('Current PIN is incorrect')

      const pinError = validatePin(newPin)
      if (pinError) return err(pinError)

      const newHash = await hashPin(newPin)
      updatePinHash(db, userId, newHash)
      writeAuditLog(db, 'PIN_CHANGED', 'users', userId, null, userId)

      return ok()
    }
  )
}

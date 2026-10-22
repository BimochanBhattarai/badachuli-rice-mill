import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { hashPin, validatePin } from '../../domain/auth'
import { createUser, getAllUsers, setUserActive, updateUsername } from '../../repository/user.repo'
import { writeAuditLog } from '../audit'
import type { IpcResult } from '../../shared/types/api'
import type { PublicUserRow } from '../../repository/user.repo'

export function registerUserHandlers(db: Database.Database): void {
  ipcMain.handle('users:getAll', (): IpcResult<PublicUserRow[]> => {
    try {
      return { ok: true, data: getAllUsers(db) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'users:create',
    async (
      _e,
      username: string,
      pin: string,
      role: 'owner' | 'operator',
      requestedByUserId: number
    ): Promise<IpcResult<{ id: number }>> => {
      try {
        if (!username?.trim()) return { ok: false, error: 'Username is required' }
        if (username.trim().length < 2) return { ok: false, error: 'Username must be at least 2 characters' }
        const pinError = validatePin(pin)
        if (pinError) return { ok: false, error: pinError }
        if (!['owner', 'operator'].includes(role)) return { ok: false, error: 'Invalid role' }

        const pinHash = await hashPin(pin)
        // Stored as typed. Login and uniqueness are case-insensitive (migration 0018),
        // so capitalisation is purely cosmetic and safe to keep.
        const name = username.trim()
        const id = createUser(db, name, pinHash, role)
        writeAuditLog(db, 'USER_CREATED', 'users', id, { username: name, role }, requestedByUserId)
        return { ok: true, data: { id } }
      } catch (e) {
        const msg = String(e)
        if (msg.includes('UNIQUE constraint')) return { ok: false, error: 'Username already taken' }
        return { ok: false, error: msg }
      }
    }
  )

  ipcMain.handle(
    'users:setActive',
    (_e, userId: number, active: boolean, requestedByUserId: number): IpcResult => {
      try {
        if (userId === requestedByUserId && !active) {
          return { ok: false, error: 'You cannot deactivate your own account' }
        }
        setUserActive(db, userId, active)
        const action = active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED'
        writeAuditLog(db, action, 'users', userId, null, requestedByUserId)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'users:resetPin',
    async (_e, userId: number, newPin: string, requestedByUserId: number): Promise<IpcResult> => {
      try {
        const pinError = validatePin(newPin)
        if (pinError) return { ok: false, error: pinError }
        const pinHash = await hashPin(newPin)
        db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(pinHash, userId)
        writeAuditLog(db, 'USER_PIN_RESET', 'users', userId, null, requestedByUserId)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'users:rename',
    (_e, userId: number, newUsername: string, requestedByUserId: number): IpcResult => {
      try {
        const trimmed = newUsername?.trim()
        if (!trimmed) return { ok: false, error: 'Username is required' }
        if (trimmed.length < 2) return { ok: false, error: 'Username must be at least 2 characters' }
        updateUsername(db, userId, trimmed)
        writeAuditLog(db, 'USER_RENAMED', 'users', userId, { newUsername: trimmed }, requestedByUserId)
        return { ok: true }
      } catch (e) {
        const msg = String(e)
        if (msg.includes('UNIQUE constraint')) return { ok: false, error: 'Username already taken' }
        return { ok: false, error: msg }
      }
    }
  )
}

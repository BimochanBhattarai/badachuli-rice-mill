import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { generateToken } from '../../repository/token.repo'
import { writeAuditLog } from '../audit'
import type { IpcResult } from '../../shared/types/api'

export function registerTokenHandlers(db: Database.Database): void {
  ipcMain.handle(
    'tokens:generate',
    (
      _e,
      businessId: number | null,
      itemId: number,
      operatorId: number,
    ): IpcResult<{ tokenNumber: number; createdAt: string }> => {
      try {
        if (!itemId) return { ok: false, error: 'Item is required' }
        if (!operatorId) return { ok: false, error: 'Operator is required' }
        const result = generateToken(db, businessId ?? null, itemId, operatorId)
        writeAuditLog(db, 'TOKEN_GENERATED', 'tokens', null, {
          tokenNumber: result.tokenNumber,
          itemId,
          businessId,
        }, operatorId)
        return { ok: true, data: result }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )
}

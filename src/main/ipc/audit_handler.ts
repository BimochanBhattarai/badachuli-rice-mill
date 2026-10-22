import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import type { IpcResult } from '../../shared/types/api'

export interface AuditLogRow {
  id: number
  action: string
  entity_type: string
  entity_id: number | null
  payload_json: string | null
  operator_id: number | null
  operator_username: string | null
  created_at: string
}

export function registerAuditHandlers(db: Database.Database): void {
  ipcMain.handle(
    'audit:getAll',
    (_e, limit = 200, offset = 0, filterAction?: string): IpcResult<AuditLogRow[]> => {
      try {
        const whereClauses: string[] = []
        const params: (string | number)[] = []

        if (filterAction) {
          whereClauses.push('a.action = ?')
          params.push(filterAction)
        }

        const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''

        const rows = db.prepare(
          `SELECT a.id, a.action, a.entity_type, a.entity_id, a.payload_json,
                  a.operator_id, u.username as operator_username, a.created_at
           FROM audit_log a
           LEFT JOIN users u ON u.id = a.operator_id
           ${where}
           ORDER BY a.created_at DESC
           LIMIT ? OFFSET ?`
        ).all(...params, limit, offset) as AuditLogRow[]

        return { ok: true, data: rows }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )
}

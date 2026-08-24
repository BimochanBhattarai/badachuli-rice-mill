import Database from 'better-sqlite3'

export type AuditAction =
  | 'USER_CREATED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PIN_CHANGED'
  | 'SETUP_COMPLETED'

export function writeAuditLog(
  db: Database.Database,
  action: AuditAction,
  entityType: string,
  entityId: number | null,
  payload: Record<string, unknown> | null,
  operatorId: number | null
): void {
  db.prepare(
    `INSERT INTO audit_log (action, entity_type, entity_id, payload_json, operator_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    action,
    entityType,
    entityId,
    payload ? JSON.stringify(payload) : null,
    operatorId
  )
}

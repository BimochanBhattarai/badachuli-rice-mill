import Database from 'better-sqlite3'

export type AuditAction =
  | 'USER_CREATED'
  | 'USER_DEACTIVATED'
  | 'USER_REACTIVATED'
  | 'USER_PIN_RESET'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PIN_CHANGED'
  | 'SETUP_COMPLETED'
  | 'BILL_CREATED'
  | 'BILL_CANCELLED'
  | 'PAYMENT_COLLECTED'
  | 'STOCK_IN'
  | 'STOCK_ADJUSTED'
  | 'SETTINGS_CHANGED'
  | 'EXPENSE_CATEGORY_CREATED'
  | 'EXPENSE_CREATED'
  | 'EXPENSE_DELETED'
  | 'LOAN_CREATED'
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_UPDATED'
  | 'EMPLOYEE_DEACTIVATED'
  | 'SALARY_PAID'
  | 'EMPLOYEE_LOAN_CREATED'
  | 'EMPLOYEE_LOAN_UPDATED'
  | 'EMPLOYEE_LOAN_REPAYMENT'
  | 'SALARY_CYCLE_CLOSED'
  | 'TOKEN_GENERATED'
  | 'USER_RENAMED'
  | 'PAYMENT_RECEIVED'
  | 'BALANCE_ADJUSTED'

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

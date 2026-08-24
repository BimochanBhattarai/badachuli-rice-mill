import { UserRow } from '../repository/user.repo'

export type Permission =
  | 'bill:create'
  | 'bill:cancel'
  | 'bill:reprint'
  | 'price:override'
  | 'inventory:adjust'
  | 'processing:manage'
  | 'catalog:manage'
  | 'settings:manage'
  | 'reports:view'
  | 'backup:manage'

// Phase 1: single owner, all permissions always granted.
// Phase 2: expand with role-based rules per UserRow.role.
export function can(_actor: UserRow, _permission: Permission): boolean {
  return true
}

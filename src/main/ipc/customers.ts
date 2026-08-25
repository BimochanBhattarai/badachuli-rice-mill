import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import {
  getAllCustomers,
  searchCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
} from '../../repository/customer.repo'
import type { IpcResult } from '../../shared/types/api'
import type { CustomerWithBalance } from '../../repository/customer.repo'

export function registerCustomerHandlers(db: Database.Database): void {
  ipcMain.handle('customers:getAll', (): IpcResult<CustomerWithBalance[]> => {
    try {
      return { ok: true, data: getAllCustomers(db) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('customers:search', (_e, query: string): IpcResult<CustomerWithBalance[]> => {
    try {
      return { ok: true, data: searchCustomers(db, query ?? '') }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('customers:getById', (_e, id: number): IpcResult<CustomerWithBalance> => {
    try {
      const c = getCustomerById(db, id)
      if (!c) return { ok: false, error: 'Customer not found' }
      return { ok: true, data: c }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'customers:create',
    (_e, name: string, phone?: string, address?: string, notes?: string): IpcResult<{ id: number }> => {
      try {
        if (!name?.trim()) return { ok: false, error: 'Customer name is required' }
        const id = createCustomer(db, name.trim(), phone, address, notes)
        return { ok: true, data: { id } }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'customers:update',
    (_e, id: number, name: string, phone?: string, address?: string, notes?: string): IpcResult => {
      try {
        if (!name?.trim()) return { ok: false, error: 'Customer name is required' }
        updateCustomer(db, id, name.trim(), phone, address, notes)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle('customers:deactivate', (_e, id: number): IpcResult => {
    try {
      deactivateCustomer(db, id)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
}

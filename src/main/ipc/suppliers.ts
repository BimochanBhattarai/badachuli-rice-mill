import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import {
  getAllSuppliers,
  searchSuppliers,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
} from '../../repository/supplier.repo'
import type { IpcResult } from '../../shared/types/api'
import type { SupplierRow } from '../../repository/supplier.repo'

export function registerSupplierHandlers(db: Database.Database): void {
  ipcMain.handle('suppliers:getAll', (): IpcResult<SupplierRow[]> => {
    try { return { ok: true, data: getAllSuppliers(db) } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('suppliers:search', (_e, query: string): IpcResult<SupplierRow[]> => {
    try { return { ok: true, data: searchSuppliers(db, query) } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle(
    'suppliers:create',
    (_e, name: string, phone?: string, address?: string, notes?: string): IpcResult<{ id: number }> => {
      try {
        if (!name?.trim()) return { ok: false, error: 'Name is required' }
        const id = createSupplier(db, name, phone, address, notes)
        return { ok: true, data: { id } }
      } catch (e) { return { ok: false, error: String(e) } }
    }
  )

  ipcMain.handle(
    'suppliers:update',
    (_e, id: number, name: string, phone?: string, address?: string, notes?: string): IpcResult => {
      try {
        if (!name?.trim()) return { ok: false, error: 'Name is required' }
        updateSupplier(db, id, name, phone, address, notes)
        return { ok: true }
      } catch (e) { return { ok: false, error: String(e) } }
    }
  )

  ipcMain.handle('suppliers:deactivate', (_e, id: number): IpcResult => {
    try { deactivateSupplier(db, id); return { ok: true } }
    catch (e) { return { ok: false, error: String(e) } }
  })
}

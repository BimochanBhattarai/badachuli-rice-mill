import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { getAllBusinesses, createBusiness, updateBusiness, deleteBusiness } from '../../repository/business.repo'
import type { BusinessRow } from '../../repository/business.repo'
import type { IpcResult } from '../../shared/types/api'

export function registerBusinessHandlers(db: Database.Database): void {
  ipcMain.handle('businesses:getAll', (): IpcResult<BusinessRow[]> => {
    try {
      return { ok: true, data: getAllBusinesses(db) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'businesses:create',
    (
      _e,
      fields: { name: string; pan_number?: string; phone?: string; address?: string; bill_prefix: string }
    ): IpcResult<{ id: number }> => {
      try {
        if (!fields.name?.trim()) return { ok: false, error: 'Business name is required' }
        if (!fields.bill_prefix?.trim()) return { ok: false, error: 'Bill prefix is required' }
        const id = createBusiness(db, fields)
        return { ok: true, data: { id } }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle('businesses:delete', (_e, id: number): IpcResult => {
    try {
      deleteBusiness(db, id)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'businesses:update',
    (
      _e,
      id: number,
      fields: { name: string; pan_number?: string; phone?: string; address?: string; bill_prefix: string }
    ): IpcResult => {
      try {
        if (!fields.name?.trim()) return { ok: false, error: 'Business name is required' }
        if (!fields.bill_prefix?.trim()) return { ok: false, error: 'Bill prefix is required' }
        updateBusiness(db, id, fields)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )
}

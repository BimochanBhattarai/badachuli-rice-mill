import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import {
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
  getDefaultUnit,
  setDefaultUnit,
} from '../../repository/unit.repo'
import type { IpcResult } from '../../shared/types/api'
import type { UnitRow } from '../../repository/unit.repo'

export function registerUnitHandlers(db: Database.Database): void {
  ipcMain.handle('units:getAll', (): IpcResult<UnitRow[]> => {
    try {
      return { ok: true, data: getAllUnits(db) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('units:getById', (_e, id: number): IpcResult<UnitRow> => {
    try {
      const unit = getUnitById(db, id)
      if (!unit) return { ok: false, error: 'Unit not found' }
      return { ok: true, data: unit }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'units:create',
    (_e, name: string, abbreviation: string, baseFactor: number): IpcResult<{ id: number }> => {
      try {
        if (!name?.trim()) return { ok: false, error: 'Unit name is required' }
        if (!abbreviation?.trim()) return { ok: false, error: 'Abbreviation is required' }
        if (baseFactor <= 0) return { ok: false, error: 'Base factor must be positive' }
        const id = createUnit(db, name.trim(), abbreviation.trim(), baseFactor)
        return { ok: true, data: { id } }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('UNIQUE')) return { ok: false, error: 'A unit with that name already exists' }
        return { ok: false, error: msg }
      }
    }
  )

  ipcMain.handle(
    'units:update',
    (_e, id: number, name: string, abbreviation: string, baseFactor: number): IpcResult => {
      try {
        if (!name?.trim()) return { ok: false, error: 'Unit name is required' }
        if (!abbreviation?.trim()) return { ok: false, error: 'Abbreviation is required' }
        if (baseFactor <= 0) return { ok: false, error: 'Base factor must be positive' }
        updateUnit(db, id, name.trim(), abbreviation.trim(), baseFactor)
        return { ok: true }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('UNIQUE')) return { ok: false, error: 'A unit with that name already exists' }
        return { ok: false, error: msg }
      }
    }
  )

  ipcMain.handle('units:delete', (_e, id: number): IpcResult => {
    try {
      const deleted = deleteUnit(db, id)
      if (!deleted) return { ok: false, error: 'Unit is in use and cannot be deleted' }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('units:getDefault', (): IpcResult<UnitRow> => {
    try {
      const unit = getDefaultUnit(db)
      if (!unit) return { ok: false, error: 'No default unit set' }
      return { ok: true, data: unit }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('units:setDefault', (_e, id: number): IpcResult => {
    try {
      const unit = getUnitById(db, id)
      if (!unit) return { ok: false, error: 'Unit not found' }
      setDefaultUnit(db, id)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
}

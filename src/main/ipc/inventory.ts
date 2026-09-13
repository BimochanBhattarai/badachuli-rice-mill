import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import {
  getAllStockLevels,
  getItemStockLevels,
  addInventoryTransaction,
  adjustStock,
} from '../../repository/inventory.repo'
import type { IpcResult } from '../../shared/types/api'
import type { StockLevel } from '../../repository/inventory.repo'

const VALID_CATEGORIES = ['raw_material', 'in_process', 'finished', 'byproduct']

export function registerInventoryHandlers(db: Database.Database): void {
  ipcMain.handle('inventory:getAll', (): IpcResult<StockLevel[]> => {
    try {
      return { ok: true, data: getAllStockLevels(db) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('inventory:getByItem', (_e, itemId: number): IpcResult<StockLevel[]> => {
    try {
      return { ok: true, data: getItemStockLevels(db, itemId) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'inventory:adjust',
    (
      _e,
      itemId: number,
      variantId: number | null,
      unitId: number,
      newQty: number,
      operatorId: number,
      notes?: string
    ): IpcResult => {
      try {
        if (!itemId) return { ok: false, error: 'Item is required' }
        if (!unitId) return { ok: false, error: 'Unit is required' }
        if (newQty < 0) return { ok: false, error: 'Quantity cannot be negative' }
        if (!operatorId) return { ok: false, error: 'Operator is required' }
        adjustStock(db, itemId, variantId, unitId, newQty, operatorId, notes)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'inventory:addOpening',
    (
      _e,
      itemId: number,
      variantId: number | null,
      unitId: number,
      qty: number,
      category: string,
      operatorId: number,
      notes?: string
    ): IpcResult<{ id: number }> => {
      try {
        if (!itemId) return { ok: false, error: 'Item is required' }
        if (!unitId) return { ok: false, error: 'Unit is required' }
        if (qty <= 0) return { ok: false, error: 'Quantity must be greater than zero' }
        if (!VALID_CATEGORIES.includes(category))
          return { ok: false, error: 'Invalid category' }
        if (!operatorId) return { ok: false, error: 'Operator is required' }

        const id = addInventoryTransaction(
          db,
          itemId,
          variantId,
          unitId,
          qty,
          category,
          'opening',
          operatorId,
          notes
        )
        return { ok: true, data: { id } }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )
}

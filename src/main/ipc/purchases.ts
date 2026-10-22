import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import {
  createPurchase,
  getPurchases,
  getPurchaseLines,
} from '../../repository/purchase.repo'
import { writeAuditLog } from '../audit'
import type { IpcResult } from '../../shared/types/api'
import type {
  CreatePurchaseInput,
  PurchaseWithSupplier,
  PurchaseLineWithDetail,
} from '../../repository/purchase.repo'

export function registerPurchaseHandlers(db: Database.Database): void {
  ipcMain.handle('purchases:getAll', (_e, limit?: number): IpcResult<PurchaseWithSupplier[]> => {
    try { return { ok: true, data: getPurchases(db, limit) } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('purchases:getLines', (_e, orderId: number): IpcResult<PurchaseLineWithDetail[]> => {
    try { return { ok: true, data: getPurchaseLines(db, orderId) } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle(
    'purchases:create',
    (_e, input: CreatePurchaseInput): IpcResult<{ orderId: number }> => {
      try {
        if (!input.supplierId) return { ok: false, error: 'Supplier is required' }
        if (!input.lines?.length) return { ok: false, error: 'Add at least one item' }
        if (!input.operatorId) return { ok: false, error: 'Operator is required' }
        const result = createPurchase(db, input)
        writeAuditLog(db, 'STOCK_IN', 'purchase_orders', result.orderId, {
          supplierId: input.supplierId,
          itemCount: input.lines.length,
          totalAmount: input.lines.reduce((s, l) => s + l.lineTotal, 0),
        }, input.operatorId)
        return { ok: true, data: result }
      } catch (e) { return { ok: false, error: String(e) } }
    }
  )
}

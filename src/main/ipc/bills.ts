import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import {
  createBill,
  getBills,
  getBillById,
  getBillLines,
  getNextBillNumber,
} from '../../repository/bill.repo'
import type { IpcResult } from '../../shared/types/api'
import type { BillWithCustomer, BillLineWithDetail, CreateBillInput } from '../../repository/bill.repo'

export function registerBillHandlers(db: Database.Database): void {
  ipcMain.handle('bills:getNextNumber', (): IpcResult<{ billNumber: string }> => {
    try {
      return { ok: true, data: { billNumber: getNextBillNumber(db) } }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('bills:getAll', (_e, limit?: number): IpcResult<BillWithCustomer[]> => {
    try {
      return { ok: true, data: getBills(db, limit) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('bills:getById', (_e, id: number): IpcResult<BillWithCustomer> => {
    try {
      const bill = getBillById(db, id)
      if (!bill) return { ok: false, error: 'Bill not found' }
      return { ok: true, data: bill }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('bills:getLines', (_e, billId: number): IpcResult<BillLineWithDetail[]> => {
    try {
      return { ok: true, data: getBillLines(db, billId) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'bills:create',
    (_e, input: CreateBillInput): IpcResult<{ billId: number; billNumber: string }> => {
      try {
        if (!input.lines?.length) return { ok: false, error: 'Bill must have at least one item' }
        if (!input.operatorId) return { ok: false, error: 'Operator is required' }
        const result = createBill(db, input)
        return { ok: true, data: result }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )
}

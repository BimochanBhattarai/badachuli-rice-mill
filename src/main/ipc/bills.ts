import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import {
  createBill,
  getBills,
  getBillById,
  getBillLines,
  getNextBillNumber,
  getBillLedgerEntries,
  cancelBill,
  getCustomerStatement,
  getCustomerItemLines,
} from '../../repository/bill.repo'
import { writeAuditLog } from '../audit'
import type { IpcResult } from '../../shared/types/api'
import type {
  BillWithCustomer, BillLineWithDetail, CreateBillInput,
  CustomerStatementEntry, CustomerItemLine,
} from '../../repository/bill.repo'
import type { LedgerEntryView } from '../../repository/ledger.repo'

export function registerBillHandlers(db: Database.Database): void {
  ipcMain.handle('bills:getNextNumber', (_e, businessId: number): IpcResult<{ billNumber: string }> => {
    try {
      return { ok: true, data: { billNumber: getNextBillNumber(db, businessId) } }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('bills:getAll', (_e, limit?: number, businessId?: number, fromDate?: string, toDate?: string): IpcResult<BillWithCustomer[]> => {
    try {
      return { ok: true, data: getBills(db, limit, businessId, fromDate, toDate) }
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
        const grandTotal = input.lines.reduce((s, l) => s + l.lineTotal, 0) - input.discountAmount
        const lineTypes = new Set(input.lines.map(l => l.lineType))
        const billKind = lineTypes.size > 1 ? 'mixed' : [...lineTypes][0]
        writeAuditLog(db, 'BILL_CREATED', 'bills', result.billId, {
          billNumber: result.billNumber,
          billType: billKind,
          grandTotal,
          itemCount: input.lines.length,
        }, input.operatorId)
        return { ok: true, data: result }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle('bills:getPayments', (_e, billId: number): IpcResult<LedgerEntryView[]> => {
    try {
      return { ok: true, data: getBillLedgerEntries(db, billId) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'bills:cancel',
    (_e, billId: number, reason: string, operatorId: number): IpcResult => {
      try {
        if (!reason?.trim()) return { ok: false, error: 'Cancellation reason is required' }
        const bill = getBillById(db, billId)
        cancelBill(db, billId, reason.trim(), operatorId)
        writeAuditLog(db, 'BILL_CANCELLED', 'bills', billId, {
          billNumber: bill?.bill_number ?? String(billId),
          reason: reason.trim(),
        }, operatorId)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'bills:getCustomerStatement',
    (_e, customerId: number): IpcResult<CustomerStatementEntry[]> => {
      try {
        return { ok: true, data: getCustomerStatement(db, customerId) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'bills:getCustomerItemLines',
    (_e, customerId: number): IpcResult<CustomerItemLine[]> => {
      try {
        return { ok: true, data: getCustomerItemLines(db, customerId) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )
}

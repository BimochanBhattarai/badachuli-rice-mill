import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import {
  getDashboardData,
  getSalesReport,
  getItemSalesReport,
  getCustomerLedger,
} from '../../repository/dashboard.repo'
import type { IpcResult } from '../../shared/types/api'
import type {
  DashboardData,
  SalesReport,
  ItemSalesLine,
  CustomerLedgerLine,
} from '../../repository/dashboard.repo'

export function registerDashboardHandlers(db: Database.Database): void {
  ipcMain.handle('dashboard:getData', (): IpcResult<DashboardData> => {
    try {
      return { ok: true, data: getDashboardData(db) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'dashboard:getSalesReport',
    (_e, fromDate: string, toDate: string): IpcResult<SalesReport> => {
      try {
        return { ok: true, data: getSalesReport(db, fromDate, toDate) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'dashboard:getItemSalesReport',
    (_e, fromDate: string, toDate: string): IpcResult<ItemSalesLine[]> => {
      try {
        return { ok: true, data: getItemSalesReport(db, fromDate, toDate) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle('dashboard:getCustomerLedger', (): IpcResult<CustomerLedgerLine[]> => {
    try {
      return { ok: true, data: getCustomerLedger(db) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
}

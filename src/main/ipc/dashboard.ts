import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import {
  getDashboardData,
  getSalesReport,
  getItemSalesReport,
  getCustomerBalances,
  getItemReport,
  getBusinessSummary,
} from '../../repository/dashboard.repo'
import type { IpcResult } from '../../shared/types/api'
import type {
  DashboardData,
  SalesReport,
  ItemSalesLine,
  CustomerLedgerLine,
  ItemReportRow,
  BusinessSummary,
} from '../../repository/dashboard.repo'

export function registerDashboardHandlers(db: Database.Database): void {
  ipcMain.handle('dashboard:getData', (_e, businessId?: number): IpcResult<DashboardData> => {
    try {
      return { ok: true, data: getDashboardData(db, businessId) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'dashboard:getSalesReport',
    (_e, fromDate: string, toDate: string, businessId?: number): IpcResult<SalesReport> => {
      try {
        return { ok: true, data: getSalesReport(db, fromDate, toDate, businessId) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'dashboard:getItemSalesReport',
    (_e, fromDate: string, toDate: string, businessId?: number): IpcResult<ItemSalesLine[]> => {
      try {
        return { ok: true, data: getItemSalesReport(db, fromDate, toDate, businessId) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle('dashboard:getCustomerBalances', (): IpcResult<CustomerLedgerLine[]> => {
    try {
      return { ok: true, data: getCustomerBalances(db) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'dashboard:getItemReport',
    (_e, billType: 'sale' | 'processing', fromDate: string, toDate: string, businessId?: number): IpcResult<ItemReportRow[]> => {
      try {
        return { ok: true, data: getItemReport(db, billType, fromDate, toDate, businessId) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'dashboard:getBusinessSummary',
    (_e, fromDate: string, toDate: string, businessId?: number): IpcResult<BusinessSummary> => {
      try {
        return { ok: true, data: getBusinessSummary(db, fromDate, toDate, businessId) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )
}

import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { registerSettingsHandlers } from './settings'
import { registerAuthHandlers } from './auth'
import { registerUnitHandlers } from './units'
import { registerItemHandlers } from './items'
import { registerPriceHandlers } from './prices'
import { registerInventoryHandlers } from './inventory'
import { registerCustomerHandlers } from './customers'
import { registerBillHandlers } from './bills'
import { registerProcessingHandlers } from './processing'
import { registerDashboardHandlers } from './dashboard'
import { registerSupplierHandlers } from './suppliers'
import { registerPurchaseHandlers } from './purchases'

export function registerIpcHandlers(db: Database.Database): void {
  registerSettingsHandlers(db)
  registerAuthHandlers(db)
  registerUnitHandlers(db)
  registerItemHandlers(db)
  registerPriceHandlers(db)
  registerInventoryHandlers(db)
  registerCustomerHandlers(db)
  registerBillHandlers(db)
  registerProcessingHandlers(db)
  registerDashboardHandlers(db)
  registerSupplierHandlers(db)
  registerPurchaseHandlers(db)

  ipcMain.handle('ping', () => 'pong')
}

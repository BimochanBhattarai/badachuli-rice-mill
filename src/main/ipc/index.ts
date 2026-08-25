import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { registerSettingsHandlers } from './settings'
import { registerAuthHandlers } from './auth'
import { registerUnitHandlers } from './units'
import { registerItemHandlers } from './items'
import { registerPriceHandlers } from './prices'
import { registerInventoryHandlers } from './inventory'

export function registerIpcHandlers(db: Database.Database): void {
  registerSettingsHandlers(db)
  registerAuthHandlers(db)
  registerUnitHandlers(db)
  registerItemHandlers(db)
  registerPriceHandlers(db)
  registerInventoryHandlers(db)

  ipcMain.handle('ping', () => 'pong')
}

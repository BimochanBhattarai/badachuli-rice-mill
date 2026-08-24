import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { registerSettingsHandlers } from './settings'
import { registerAuthHandlers } from './auth'

export function registerIpcHandlers(db: Database.Database): void {
  registerSettingsHandlers(db)
  registerAuthHandlers(db)

  ipcMain.handle('ping', () => 'pong')
}

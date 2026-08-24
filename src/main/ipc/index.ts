import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { registerSettingsHandlers } from './settings'

export function registerIpcHandlers(db: Database.Database): void {
  registerSettingsHandlers(db)

  ipcMain.handle('ping', () => 'pong')
}

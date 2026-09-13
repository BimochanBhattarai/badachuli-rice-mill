import { ipcMain } from 'electron'
import {
  getBackupStatus,
  saveClientCredentials,
  setScheduleHour,
  startOAuthFlow,
  disconnectDrive,
  backupNow,
} from '../backup'

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:status', () => getBackupStatus())

  ipcMain.handle('backup:saveCredentials', (_e, clientId: string, clientSecret: string) => {
    saveClientCredentials(clientId, clientSecret)
    return { ok: true }
  })

  ipcMain.handle('backup:connect', async () => {
    return startOAuthFlow()
  })

  ipcMain.handle('backup:disconnect', () => {
    disconnectDrive()
    return { ok: true }
  })

  ipcMain.handle('backup:now', async () => {
    return backupNow()
  })

  ipcMain.handle('backup:setScheduleHour', (_e, hour: number) => {
    setScheduleHour(hour)
    return { ok: true }
  })
}

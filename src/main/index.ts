import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { join } from 'path'
import { openDatabase } from './db'
import { registerIpcHandlers } from './ipc'
import { startEveningScheduler } from './backup'

app.setName('Badachuli Rice Mill')
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null

function createWindow() {
  const iconPath = app.isPackaged
    ? join(__dirname, '../../resources/icon.png')
    : join(__dirname, '../../resources/icon.png')

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    title: 'Badachuli Rice Mill',
    show: false
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Set dock icon in dev mode (packaged builds use the bundle icon automatically)
  if (!app.isPackaged && process.platform === 'darwin') {
    const iconPath = join(__dirname, '../../resources/icon.png')
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }

  const db = openDatabase()
  registerIpcHandlers(db)
  startEveningScheduler()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

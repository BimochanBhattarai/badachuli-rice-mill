import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),

  auth: {
    isFirstRun: () => ipcRenderer.invoke('auth:isFirstRun'),
    setupOwner: (username: string, pin: string) =>
      ipcRenderer.invoke('auth:setupOwner', username, pin),
    login: (username: string, pin: string) =>
      ipcRenderer.invoke('auth:login', username, pin),
    changePin: (userId: number, currentPin: string, newPin: string) =>
      ipcRenderer.invoke('auth:changePin', userId, currentPin, newPin)
  },

  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value)
  }
})

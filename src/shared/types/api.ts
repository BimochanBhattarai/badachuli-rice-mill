export interface IpcResult<T = null> {
  ok: boolean
  data?: T
  error?: string
}

export interface AuthUser {
  id: number
  username: string
  role: string
}

export interface ElectronAPI {
  ping: () => Promise<string>

  auth: {
    isFirstRun: () => Promise<IpcResult<boolean>>
    setupOwner: (username: string, pin: string) => Promise<IpcResult<{ userId: number }>>
    login: (username: string, pin: string) => Promise<IpcResult<AuthUser>>
    changePin: (userId: number, currentPin: string, newPin: string) => Promise<IpcResult>
  }

  settings: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<boolean>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

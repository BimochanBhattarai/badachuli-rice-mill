export interface ElectronAPI {
  ping: () => Promise<string>
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

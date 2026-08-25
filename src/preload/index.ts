import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),

  auth: {
    isFirstRun: () => ipcRenderer.invoke('auth:isFirstRun'),
    setupOwner: (username: string, pin: string) =>
      ipcRenderer.invoke('auth:setupOwner', username, pin),
    login: (username: string, pin: string) => ipcRenderer.invoke('auth:login', username, pin),
    changePin: (userId: number, currentPin: string, newPin: string) =>
      ipcRenderer.invoke('auth:changePin', userId, currentPin, newPin),
  },

  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
  },

  units: {
    getAll: () => ipcRenderer.invoke('units:getAll'),
    getById: (id: number) => ipcRenderer.invoke('units:getById', id),
    create: (name: string, abbreviation: string, baseFactor: number) =>
      ipcRenderer.invoke('units:create', name, abbreviation, baseFactor),
    update: (id: number, name: string, abbreviation: string, baseFactor: number) =>
      ipcRenderer.invoke('units:update', id, name, abbreviation, baseFactor),
    delete: (id: number) => ipcRenderer.invoke('units:delete', id),
    getDefault: () => ipcRenderer.invoke('units:getDefault'),
    setDefault: (id: number) => ipcRenderer.invoke('units:setDefault', id),
  },

  items: {
    getAll: (activeOnly?: boolean) => ipcRenderer.invoke('items:getAll', activeOnly),
    getById: (id: number) => ipcRenderer.invoke('items:getById', id),
    search: (query: string, category?: string) =>
      ipcRenderer.invoke('items:search', query, category),
    create: (name: string, category: string, defaultUnitId: number) =>
      ipcRenderer.invoke('items:create', name, category, defaultUnitId),
    update: (id: number, name: string, category: string, defaultUnitId: number) =>
      ipcRenderer.invoke('items:update', id, name, category, defaultUnitId),
    deactivate: (id: number) => ipcRenderer.invoke('items:deactivate', id),
  },

  variants: {
    getByItem: (itemId: number) => ipcRenderer.invoke('variants:getByItem', itemId),
    getById: (id: number) => ipcRenderer.invoke('variants:getById', id),
    create: (itemId: number, name: string, isDefault: boolean) =>
      ipcRenderer.invoke('variants:create', itemId, name, isDefault),
    update: (id: number, name: string, isDefault: boolean) =>
      ipcRenderer.invoke('variants:update', id, name, isDefault),
    deactivate: (id: number) => ipcRenderer.invoke('variants:deactivate', id),
  },

  prices: {
    getCurrent: (itemId: number) => ipcRenderer.invoke('prices:getCurrent', itemId),
    getHistory: (itemId: number, variantId: number | null, priceType: 'sell' | 'buy') =>
      ipcRenderer.invoke('prices:getHistory', itemId, variantId, priceType),
    set: (
      itemId: number,
      variantId: number | null,
      unitId: number,
      price: number,
      priceType: 'sell' | 'buy',
      effectiveFrom: string
    ) => ipcRenderer.invoke('prices:set', itemId, variantId, unitId, price, priceType, effectiveFrom),
  },
})

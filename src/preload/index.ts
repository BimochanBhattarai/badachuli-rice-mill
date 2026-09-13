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
    search: (query: string, filter?: { sellable?: boolean; buyable?: boolean; processable?: boolean }) =>
      ipcRenderer.invoke('items:search', query, filter),
    create: (name: string, defaultUnitId: number, isBuyable: boolean, isSellable: boolean, isProcessable: boolean) =>
      ipcRenderer.invoke('items:create', name, defaultUnitId, isBuyable, isSellable, isProcessable),
    update: (id: number, name: string, defaultUnitId: number, isBuyable: boolean, isSellable: boolean, isProcessable: boolean) =>
      ipcRenderer.invoke('items:update', id, name, defaultUnitId, isBuyable, isSellable, isProcessable),
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

  inventory: {
    getAll: () => ipcRenderer.invoke('inventory:getAll'),
    getByItem: (itemId: number) => ipcRenderer.invoke('inventory:getByItem', itemId),
    adjust: (
      itemId: number,
      variantId: number | null,
      unitId: number,
      newQty: number,
      operatorId: number,
      notes?: string
    ) => ipcRenderer.invoke('inventory:adjust', itemId, variantId, unitId, newQty, operatorId, notes),
    addOpening: (
      itemId: number,
      variantId: number | null,
      unitId: number,
      qty: number,
      category: string,
      operatorId: number,
      notes?: string
    ) => ipcRenderer.invoke('inventory:addOpening', itemId, variantId, unitId, qty, category, operatorId, notes),
  },

  customers: {
    getAll: () => ipcRenderer.invoke('customers:getAll'),
    search: (query: string) => ipcRenderer.invoke('customers:search', query),
    getById: (id: number) => ipcRenderer.invoke('customers:getById', id),
    create: (name: string, phone?: string, address?: string, notes?: string) =>
      ipcRenderer.invoke('customers:create', name, phone, address, notes),
    update: (id: number, name: string, phone?: string, address?: string, notes?: string) =>
      ipcRenderer.invoke('customers:update', id, name, phone, address, notes),
    deactivate: (id: number) => ipcRenderer.invoke('customers:deactivate', id),
  },

  print: {
    pdf: () => ipcRenderer.invoke('print:pdf'),
    window: () => ipcRenderer.invoke('print:window'),
    receipt: (bill: unknown, lines: unknown, business: unknown, printerIp?: string) =>
      ipcRenderer.invoke('print:receipt', bill, lines, business, printerIp),
  },

  businesses: {
    getAll: () => ipcRenderer.invoke('businesses:getAll'),
    create: (fields: { name: string; pan_number?: string; phone?: string; address?: string; bill_prefix: string }) =>
      ipcRenderer.invoke('businesses:create', fields),
    update: (id: number, fields: { name: string; pan_number?: string; phone?: string; address?: string; bill_prefix: string }) =>
      ipcRenderer.invoke('businesses:update', id, fields),
    delete: (id: number) => ipcRenderer.invoke('businesses:delete', id),
  },

  bills: {
    getNextNumber: (businessId: number) => ipcRenderer.invoke('bills:getNextNumber', businessId),
    getAll: (limit?: number, businessId?: number) => ipcRenderer.invoke('bills:getAll', limit, businessId),
    getById: (id: number) => ipcRenderer.invoke('bills:getById', id),
    getLines: (billId: number) => ipcRenderer.invoke('bills:getLines', billId),
    getPayments: (billId: number) => ipcRenderer.invoke('bills:getPayments', billId),
    getCustomerStatement: (customerId: number, businessId?: number) => ipcRenderer.invoke('bills:getCustomerStatement', customerId, businessId),
    create: (input: unknown) => ipcRenderer.invoke('bills:create', input),
    collectPayment: (billId: number, amount: number, method: string, operatorId: number) =>
      ipcRenderer.invoke('bills:collectPayment', billId, amount, method, operatorId),
    cancel: (billId: number, reason: string, operatorId: number) =>
      ipcRenderer.invoke('bills:cancel', billId, reason, operatorId),
  },

  suppliers: {
    getAll: () => ipcRenderer.invoke('suppliers:getAll'),
    search: (query: string) => ipcRenderer.invoke('suppliers:search', query),
    create: (name: string, phone?: string, address?: string, notes?: string) =>
      ipcRenderer.invoke('suppliers:create', name, phone, address, notes),
    update: (id: number, name: string, phone?: string, address?: string, notes?: string) =>
      ipcRenderer.invoke('suppliers:update', id, name, phone, address, notes),
    deactivate: (id: number) => ipcRenderer.invoke('suppliers:deactivate', id),
  },

  purchases: {
    getAll: (limit?: number) => ipcRenderer.invoke('purchases:getAll', limit),
    getLines: (orderId: number) => ipcRenderer.invoke('purchases:getLines', orderId),
    create: (input: unknown) => ipcRenderer.invoke('purchases:create', input),
  },

  dashboard: {
    getData: (businessId?: number) => ipcRenderer.invoke('dashboard:getData', businessId),
    getSalesReport: (fromDate: string, toDate: string, businessId?: number) =>
      ipcRenderer.invoke('dashboard:getSalesReport', fromDate, toDate, businessId),
    getItemSalesReport: (fromDate: string, toDate: string, businessId?: number) =>
      ipcRenderer.invoke('dashboard:getItemSalesReport', fromDate, toDate, businessId),
    getCustomerLedger: () => ipcRenderer.invoke('dashboard:getCustomerLedger'),
  },

  processing: {
    getRules: () => ipcRenderer.invoke('processing:getRules'),
    createRule: (
      name: string,
      inputItemId: number,
      inputVariantId: number | null,
      inputUnitId: number,
      outputs: { outputItemId: number; outputVariantId: number | null; outputUnitId: number; yieldPct: number }[],
      notes?: string
    ) => ipcRenderer.invoke('processing:createRule', name, inputItemId, inputVariantId, inputUnitId, outputs, notes),
    deactivateRule: (id: number) => ipcRenderer.invoke('processing:deactivateRule', id),
    runBatch: (input: unknown) => ipcRenderer.invoke('processing:runBatch', input),
    getRecentBatches: (limit?: number) => ipcRenderer.invoke('processing:getRecentBatches', limit),
    runAdHocBatch: (input: unknown) => ipcRenderer.invoke('processing:runAdHocBatch', input),
    getRecentMillBatches: (limit?: number) => ipcRenderer.invoke('processing:getRecentMillBatches', limit),
    getPresetsForItem: (inputItemId: number) => ipcRenderer.invoke('processing:getPresetsForItem', inputItemId),
  },

  prices: {
    getAllCurrent: (priceType: 'sell' | 'processing') =>
      ipcRenderer.invoke('prices:getAllCurrent', priceType),
    getCurrent: (itemId: number) => ipcRenderer.invoke('prices:getCurrent', itemId),
    getHistory: (itemId: number, variantId: number | null, priceType: 'sell' | 'buy' | 'processing') =>
      ipcRenderer.invoke('prices:getHistory', itemId, variantId, priceType),
    set: (
      itemId: number,
      variantId: number | null,
      unitId: number,
      price: number,
      priceType: 'sell' | 'buy' | 'processing',
      effectiveFrom: string
    ) => ipcRenderer.invoke('prices:set', itemId, variantId, unitId, price, priceType, effectiveFrom),
  },

  backup: {
    status: () => ipcRenderer.invoke('backup:status'),
    saveCredentials: (clientId: string, clientSecret: string) =>
      ipcRenderer.invoke('backup:saveCredentials', clientId, clientSecret),
    connect: () => ipcRenderer.invoke('backup:connect'),
    disconnect: () => ipcRenderer.invoke('backup:disconnect'),
    now: () => ipcRenderer.invoke('backup:now'),
    setScheduleHour: (hour: number) => ipcRenderer.invoke('backup:setScheduleHour', hour),
  },
})

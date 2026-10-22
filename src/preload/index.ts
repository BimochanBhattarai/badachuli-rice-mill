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
    recoverWithCode: (code: string, newPin: string) =>
      ipcRenderer.invoke('auth:recoverWithCode', code, newPin),
    regenerateRecoveryCode: (userId: number, currentPin: string) =>
      ipcRenderer.invoke('auth:regenerateRecoveryCode', userId, currentPin),
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
    create: (name: string, defaultUnitId: number, isBuyable: boolean, isSellable: boolean, isProcessable: boolean, enableToken?: boolean) =>
      ipcRenderer.invoke('items:create', name, defaultUnitId, isBuyable, isSellable, isProcessable, enableToken ?? false),
    update: (id: number, name: string, defaultUnitId: number, isBuyable: boolean, isSellable: boolean, isProcessable: boolean, enableToken?: boolean) =>
      ipcRenderer.invoke('items:update', id, name, defaultUnitId, isBuyable, isSellable, isProcessable, enableToken ?? false),
    deactivate: (id: number) => ipcRenderer.invoke('items:deactivate', id),
    restore: (id: number) => ipcRenderer.invoke('items:restore', id),
    setPriority: (id: number, priority: number | null) => ipcRenderer.invoke('items:setPriority', id, priority),
  },

  variants: {
    getByItem: (itemId: number) => ipcRenderer.invoke('variants:getByItem', itemId),
    getById: (id: number) => ipcRenderer.invoke('variants:getById', id),
    create: (itemId: number, name: string, isDefault: boolean) =>
      ipcRenderer.invoke('variants:create', itemId, name, isDefault),
    update: (id: number, name: string, isDefault: boolean) =>
      ipcRenderer.invoke('variants:update', id, name, isDefault),
    deactivate: (id: number) => ipcRenderer.invoke('variants:deactivate', id),
    getArchived: () => ipcRenderer.invoke('variants:getArchived'),
    restore: (id: number) => ipcRenderer.invoke('variants:restore', id),
    setPriority: (id: number, priority: number | null) => ipcRenderer.invoke('variants:setPriority', id, priority),
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
    getAll: (activeOnly?: boolean) => ipcRenderer.invoke('customers:getAll', activeOnly),
    search: (query: string) => ipcRenderer.invoke('customers:search', query),
    getById: (id: number) => ipcRenderer.invoke('customers:getById', id),
    create: (name: string, phone?: string, address?: string, notes?: string, panNumber?: string) =>
      ipcRenderer.invoke('customers:create', name, phone, address, notes, panNumber),
    update: (id: number, name: string, phone?: string, address?: string, notes?: string, panNumber?: string) =>
      ipcRenderer.invoke('customers:update', id, name, phone, address, notes, panNumber),
    deactivate: (id: number) => ipcRenderer.invoke('customers:deactivate', id),
    restore: (id: number) => ipcRenderer.invoke('customers:restore', id),
    receivePayment: (
      customerId: number, amount: number, method: string, operatorId: number, note?: string
    ) => ipcRenderer.invoke('customers:receivePayment', customerId, amount, method, operatorId, note),
  },

  print: {
    pdf: () => ipcRenderer.invoke('print:pdf'),
    window: () => ipcRenderer.invoke('print:window'),
    receipt: (bill: unknown, lines: unknown, business: unknown, printerIp?: string) =>
      ipcRenderer.invoke('print:receipt', bill, lines, business, printerIp),
    token: (business: unknown, tokenNumber: number, itemName: string, createdAt: string, printerIp?: string) =>
      ipcRenderer.invoke('print:token', business, tokenNumber, itemName, createdAt, printerIp),
  },

  tokens: {
    generate: (businessId: number | null, itemId: number, operatorId: number) =>
      ipcRenderer.invoke('tokens:generate', businessId, itemId, operatorId),
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
    getAll: (limit?: number, businessId?: number, fromDate?: string, toDate?: string) => ipcRenderer.invoke('bills:getAll', limit, businessId, fromDate, toDate),
    getById: (id: number) => ipcRenderer.invoke('bills:getById', id),
    getLines: (billId: number) => ipcRenderer.invoke('bills:getLines', billId),
    getPayments: (billId: number) => ipcRenderer.invoke('bills:getPayments', billId),
    getCustomerStatement: (customerId: number) =>
      ipcRenderer.invoke('bills:getCustomerStatement', customerId),
    getCustomerItemLines: (customerId: number) =>
      ipcRenderer.invoke('bills:getCustomerItemLines', customerId),
    create: (input: unknown) => ipcRenderer.invoke('bills:create', input),
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
    getCustomerBalances: () => ipcRenderer.invoke('dashboard:getCustomerBalances'),
    getItemReport: (billType: 'sale' | 'processing', fromDate: string, toDate: string, businessId?: number) =>
      ipcRenderer.invoke('dashboard:getItemReport', billType, fromDate, toDate, businessId),
    getBusinessSummary: (fromDate: string, toDate: string, businessId?: number) =>
      ipcRenderer.invoke('dashboard:getBusinessSummary', fromDate, toDate, businessId),
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

  users: {
    getAll: () => ipcRenderer.invoke('users:getAll'),
    create: (username: string, pin: string, role: 'owner' | 'operator', requestedByUserId: number) =>
      ipcRenderer.invoke('users:create', username, pin, role, requestedByUserId),
    setActive: (id: number, active: boolean, requestedByUserId: number) =>
      ipcRenderer.invoke('users:setActive', id, active, requestedByUserId),
    resetPin: (id: number, newPin: string, requestedByUserId: number) =>
      ipcRenderer.invoke('users:resetPin', id, newPin, requestedByUserId),
    rename: (id: number, newUsername: string, requestedByUserId: number) =>
      ipcRenderer.invoke('users:rename', id, newUsername, requestedByUserId),
  },

  audit: {
    getAll: (limit?: number, offset?: number, filterAction?: string) =>
      ipcRenderer.invoke('audit:getAll', limit, offset, filterAction),
  },

  expenses: {
    getCategories: () => ipcRenderer.invoke('expenses:getCategories'),
    createCategory: (name: string, operatorId: number) =>
      ipcRenderer.invoke('expenses:createCategory', name, operatorId),
    getAll: (fromDate?: string, toDate?: string) =>
      ipcRenderer.invoke('expenses:getAll', fromDate, toDate),
    create: (categoryId: number, amount: number, operatorId: number, description?: string, expenseDate?: string) =>
      ipcRenderer.invoke('expenses:create', categoryId, amount, operatorId, description, expenseDate),
    update: (id: number, categoryId: number, amount: number, description: string | null, expenseDate: string, operatorId: number) =>
      ipcRenderer.invoke('expenses:update', id, categoryId, amount, description, expenseDate, operatorId),
    delete: (id: number, operatorId: number) =>
      ipcRenderer.invoke('expenses:delete', id, operatorId),
  },

  loans: {
    getByCustomer: (customerId: number) =>
      ipcRenderer.invoke('loans:getByCustomer', customerId),
    getAll: () => ipcRenderer.invoke('loans:getAll'),
    create: (customerId: number, amount: number, operatorId: number, description?: string, loanDate?: string) =>
      ipcRenderer.invoke('loans:create', customerId, amount, operatorId, description, loanDate),
  },

  salary: {
    getEmployees: (activeOnly?: boolean) =>
      ipcRenderer.invoke('salary:getEmployees', activeOnly),
    createEmployee: (name: string, phone: string | undefined, position: string | undefined, operatorId: number, baseSalary?: number) =>
      ipcRenderer.invoke('salary:createEmployee', name, phone, position, operatorId, baseSalary),
    updateEmployee: (id: number, name: string, phone: string | undefined, position: string | undefined, operatorId: number, baseSalary?: number) =>
      ipcRenderer.invoke('salary:updateEmployee', id, name, phone, position, operatorId, baseSalary),
    deactivateEmployee: (id: number, operatorId: number) =>
      ipcRenderer.invoke('salary:deactivateEmployee', id, operatorId),
    getPayments: (employeeId: number) =>
      ipcRenderer.invoke('salary:getPayments', employeeId),
    recordPayment: (employeeId: number, amount: number, txnType: string, operatorId: number, description?: string, paidDate?: string) =>
      ipcRenderer.invoke('salary:recordPayment', employeeId, amount, txnType, operatorId, description, paidDate),
    deletePayment: (id: number, operatorId: number) =>
      ipcRenderer.invoke('salary:deletePayment', id, operatorId),
    getEmployeeLoans: (employeeId: number) =>
      ipcRenderer.invoke('salary:getEmployeeLoans', employeeId),
    createEmployeeLoan: (employeeId: number, amount: number, operatorId: number, description?: string, loanDate?: string) =>
      ipcRenderer.invoke('salary:createEmployeeLoan', employeeId, amount, operatorId, description, loanDate),
    updateEmployeeLoan: (loanId: number, employeeId: number, amount: number, operatorId: number, description?: string, loanDate?: string) =>
      ipcRenderer.invoke('salary:updateEmployeeLoan', loanId, employeeId, amount, operatorId, description, loanDate),
    recordLoanRepayment: (loanId: number, employeeId: number, amount: number, operatorId: number, paidDate?: string) =>
      ipcRenderer.invoke('salary:recordLoanRepayment', loanId, employeeId, amount, operatorId, paidDate),
    getRemaining: (employeeId: number) =>
      ipcRenderer.invoke('salary:getRemaining', employeeId),
    payRemaining: (employeeId: number, operatorId: number) =>
      ipcRenderer.invoke('salary:payRemaining', employeeId, operatorId),
  },
})

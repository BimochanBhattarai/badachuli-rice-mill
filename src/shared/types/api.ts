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

export interface UnitRow {
  id: number
  name: string
  abbreviation: string
  base_factor: number
  is_default: number
}

export interface ItemRow {
  id: number
  name: string
  category: 'raw_material' | 'finished' | 'byproduct' | 'consumable'
  default_unit_id: number
  is_active: number
  is_buyable: number
  is_sellable: number
  is_processable: number
  created_at: string
  unit_name: string
  unit_abbreviation: string
}

export interface VariantRow {
  id: number
  item_id: number
  name: string
  is_default: number
  is_active: number
}

export interface PriceRow {
  id: number
  item_id: number
  variant_id: number | null
  unit_id: number
  price: number
  price_type: 'sell' | 'buy'
  effective_from: string
  effective_to: string | null
  created_at: string
}

export interface CurrentPrice extends PriceRow {
  item_name: string
  variant_name: string | null
  unit_abbreviation: string
}

export interface StockLevel {
  item_id: number
  item_name: string
  item_category: string
  variant_id: number | null
  variant_name: string | null
  unit_id: number
  unit_abbreviation: string
  balance: number
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

  units: {
    getAll: () => Promise<IpcResult<UnitRow[]>>
    getById: (id: number) => Promise<IpcResult<UnitRow>>
    create: (name: string, abbreviation: string, baseFactor: number) => Promise<IpcResult<{ id: number }>>
    update: (id: number, name: string, abbreviation: string, baseFactor: number) => Promise<IpcResult>
    delete: (id: number) => Promise<IpcResult>
    getDefault: () => Promise<IpcResult<UnitRow>>
    setDefault: (id: number) => Promise<IpcResult>
  }

  items: {
    getAll: (activeOnly?: boolean) => Promise<IpcResult<ItemRow[]>>
    getById: (id: number) => Promise<IpcResult<ItemRow>>
    search: (
      query: string,
      filter?: { sellable?: boolean; buyable?: boolean; processable?: boolean }
    ) => Promise<IpcResult<ItemRow[]>>
    create: (
      name: string,
      defaultUnitId: number,
      isBuyable: boolean,
      isSellable: boolean,
      isProcessable: boolean
    ) => Promise<IpcResult<{ id: number; variantId: number }>>
    update: (
      id: number,
      name: string,
      defaultUnitId: number,
      isBuyable: boolean,
      isSellable: boolean,
      isProcessable: boolean
    ) => Promise<IpcResult>
    deactivate: (id: number) => Promise<IpcResult>
  }

  variants: {
    getByItem: (itemId: number) => Promise<IpcResult<VariantRow[]>>
    getById: (id: number) => Promise<IpcResult<VariantRow>>
    create: (itemId: number, name: string, isDefault: boolean) => Promise<IpcResult<{ id: number }>>
    update: (id: number, name: string, isDefault: boolean) => Promise<IpcResult>
    deactivate: (id: number) => Promise<IpcResult>
  }

  inventory: {
    getAll: () => Promise<IpcResult<StockLevel[]>>
    getByItem: (itemId: number) => Promise<IpcResult<StockLevel[]>>
    addOpening: (
      itemId: number,
      variantId: number | null,
      unitId: number,
      qty: number,
      category: string,
      operatorId: number,
      notes?: string
    ) => Promise<IpcResult<{ id: number }>>
  }

  customers: {
    getAll: () => Promise<IpcResult<CustomerWithBalance[]>>
    search: (query: string) => Promise<IpcResult<CustomerWithBalance[]>>
    getById: (id: number) => Promise<IpcResult<CustomerWithBalance>>
    create: (name: string, phone?: string, address?: string, notes?: string) => Promise<IpcResult<{ id: number }>>
    update: (id: number, name: string, phone?: string, address?: string, notes?: string) => Promise<IpcResult>
    deactivate: (id: number) => Promise<IpcResult>
  }

  bills: {
    getNextNumber: () => Promise<IpcResult<{ billNumber: string }>>
    getAll: (limit?: number) => Promise<IpcResult<BillWithCustomer[]>>
    getById: (id: number) => Promise<IpcResult<BillWithCustomer>>
    getLines: (billId: number) => Promise<IpcResult<BillLineWithDetail[]>>
    create: (input: CreateBillInput) => Promise<IpcResult<{ billId: number; billNumber: string }>>
    collectPayment: (billId: number, amount: number, method: string, operatorId: number) => Promise<IpcResult>
  }

  processing: {
    getRules: () => Promise<IpcResult<ProcessingRuleWithDetail[]>>
    createRule: (
      name: string,
      inputItemId: number,
      inputVariantId: number | null,
      inputUnitId: number,
      outputs: { outputItemId: number; outputVariantId: number | null; outputUnitId: number; yieldPct: number }[],
      notes?: string
    ) => Promise<IpcResult<{ id: number }>>
    deactivateRule: (id: number) => Promise<IpcResult>
    runBatch: (input: RunBatchInput) => Promise<IpcResult<{ batchId: number }>>
    getRecentBatches: (limit?: number) => Promise<IpcResult<BatchWithRule[]>>
  }

  prices: {
    getCurrent: (itemId: number) => Promise<IpcResult<CurrentPrice[]>>
    getHistory: (
      itemId: number,
      variantId: number | null,
      priceType: 'sell' | 'buy'
    ) => Promise<IpcResult<PriceRow[]>>
    set: (
      itemId: number,
      variantId: number | null,
      unitId: number,
      price: number,
      priceType: 'sell' | 'buy',
      effectiveFrom: string
    ) => Promise<IpcResult<{ id: number }>>
  }
}

export interface CustomerRow {
  id: number
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  is_active: number
  created_at: string
}

export interface CustomerWithBalance extends CustomerRow {
  total_billed: number
  total_paid: number
  outstanding: number
}

export interface BillRow {
  id: number
  bill_number: string
  bill_type: 'sale' | 'processing'
  status: 'draft' | 'active' | 'cancelled'
  customer_id: number | null
  subtotal: number
  discount_amount: number
  grand_total: number
  paid_amount: number
  due_amount: number
  notes: string | null
  operator_id: number
  created_at: string
}

export interface BillWithCustomer extends BillRow {
  customer_name: string | null
  customer_phone: string | null
}

export interface BillLineInput {
  itemId: number
  variantId: number | null
  qty: number
  unitId: number
  rateSnapshot: number
  lineDiscount: number
  lineTotal: number
  sortOrder: number
}

export interface BillLineWithDetail {
  id: number
  bill_id: number
  item_id: number
  variant_id: number | null
  qty: number
  unit_id: number
  rate_snapshot: number
  line_discount: number
  line_total: number
  sort_order: number
  item_name: string
  variant_name: string | null
  unit_abbreviation: string
}

export interface ProcessingRuleOutputRow {
  id: number
  rule_id: number
  output_item_id: number
  output_variant_id: number | null
  output_unit_id: number
  yield_pct: number
  sort_order: number
  output_item_name: string
  output_variant_name: string | null
  output_unit_abbreviation: string
}

export interface ProcessingRuleWithDetail {
  id: number
  name: string
  input_item_id: number
  input_variant_id: number | null
  input_unit_id: number
  is_active: number
  notes: string | null
  created_at: string
  input_item_name: string
  input_variant_name: string | null
  input_unit_abbreviation: string
  outputs: ProcessingRuleOutputRow[]
}

export interface BatchOutputInput {
  outputItemId: number
  outputVariantId: number | null
  outputUnitId: number
  expectedQty: number
  actualQty: number
}

export interface RunBatchInput {
  ruleId: number
  inputItemId: number
  inputVariantId: number | null
  inputUnitId: number
  inputQty: number
  batchType: 'in_house' | 'customer'
  customerId: number | null
  outputs: BatchOutputInput[]
  notes?: string
  operatorId: number
}

export interface BatchWithRule {
  id: number
  rule_name: string
  input_item_name: string
  input_variant_name: string | null
  input_unit_abbreviation: string
  input_qty: number
  batch_type: string
  customer_name: string | null
  operator_id: number
  created_at: string
}

export interface CreateBillInput {
  billType: 'sale' | 'processing'
  customerId: number | null
  lines: BillLineInput[]
  discountAmount: number
  paidAmount: number
  paymentMethod: 'cash' | 'bank' | 'digital' | 'credit'
  notes?: string
  operatorId: number
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

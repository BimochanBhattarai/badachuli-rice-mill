export interface UserRow {
  id: number
  username: string
  role: 'owner' | 'operator'
  is_active: number
  created_at: string
}

export interface AuditLogRow {
  id: number
  action: string
  entity_type: string
  entity_id: number | null
  payload_json: string | null
  operator_id: number | null
  operator_username: string | null
  created_at: string
}

export interface BusinessRow {
  id: number
  name: string
  pan_number: string | null
  phone: string | null
  address: string | null
  bill_prefix: string
  bill_next_sequence: number
}

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
  enable_token: number
  created_at: string
  unit_name: string
  unit_abbreviation: string
  priority: number | null
}

export interface VariantRow {
  id: number
  item_id: number
  name: string
  is_default: number
  is_active: number
  priority: number | null
}

export interface PriceRow {
  id: number
  item_id: number
  variant_id: number | null
  unit_id: number
  price: number
  price_type: 'sell' | 'buy' | 'processing'
  effective_from: string
  effective_to: string | null
  created_at: string
}

export interface PriceListEntry {
  item_id: number
  item_name: string
  unit_id: number
  unit_abbr: string
  variant_id: number
  variant_name: string
  price_id: number | null
  price: number | null
  effective_from: string | null
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

export interface SupplierRow {
  id: number
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  is_active: number
  created_at: string
}

export interface PurchaseLineInput {
  itemId: number
  variantId: number | null
  qty: number
  unitId: number
  rate: number
  lineTotal: number
}

export interface CreatePurchaseInput {
  supplierId: number
  lines: PurchaseLineInput[]
  notes?: string
  operatorId: number
}

export interface PurchaseWithSupplier {
  id: number
  supplier_id: number
  supplier_name: string
  supplier_phone: string | null
  status: string
  notes: string | null
  total_amount: number
  line_count: number
  operator_id: number
  created_at: string
}

export interface PurchaseLineWithDetail {
  id: number
  order_id: number
  item_id: number
  variant_id: number | null
  qty: number
  unit_id: number
  rate: number
  line_total: number
  item_name: string
  variant_name: string | null
  unit_abbreviation: string
}

export interface TodaySummary {
  bill_count: number
  total_billed: number
  /** Counter cash + debt collected today. */
  total_collected: number
  /** The debt-collection share of total_collected. */
  debt_collected: number
  new_udharo: number
}

export type LedgerKind =
  | 'opening'
  | 'sale'
  | 'payment'
  | 'loan'
  | 'loan_repayment'
  | 'cancel_reversal'
  | 'adjustment'

/** One row of the append-only customer ledger. */
export interface LedgerEntryView {
  id: number
  customer_id: number
  kind: LedgerKind
  /** Signed: positive = customer owes (Dr.), negative = credit (Cr.). */
  amount: number
  balance_after: number
  bill_id: number | null
  bill_number: string | null
  loan_id: number | null
  business_id: number | null
  business_name: string | null
  method: string | null
  note: string | null
  operator_id: number | null
  reversed_of: number | null
  entry_date: string
  created_at: string
}

export interface CustomerStatementEntry {
  id: number
  kind: LedgerKind
  entry_date: string
  created_at: string
  bill_id: number | null
  bill_number: string | null
  business_name: string | null
  description: string
  debit: number
  credit: number
  /** Server-computed running balance. Never re-accumulated client-side. */
  balance: number
  method: string | null
}

/**
 * One bill line of one customer, flattened across all their active bills.
 * The statement answers "how much money"; this answers "what goods".
 */
export interface CustomerItemLine {
  line_id: number
  bill_id: number
  bill_number: string
  business_name: string | null
  created_at: string
  item_id: number
  item_name: string
  /** raw_material | finished | byproduct | consumable */
  item_category: string
  variant_id: number | null
  variant_name: string | null
  unit_abbreviation: string
  qty: number
  rate_snapshot: number
  line_discount: number
  line_total: number
  line_type: 'sale' | 'processing'
}

export interface WeeklySalesDay {
  date: string
  total: number
}

export interface DashboardData {
  today: TodaySummary
  /** All-time gross receivable. Used by the "Total outstanding" banner. */
  total_outstanding: number
  stock_item_count: number
  processing_batches_today: number
  weekly_sales: WeeklySalesDay[]
}

export interface SalesReportLine {
  bill_number: string
  created_at: string
  customer_name: string | null
  grand_total: number
  paid_amount: number
  credit_amount: number
  status: string
}

export interface SalesReport {
  lines: SalesReportLine[]
  total_billed: number
  total_collected: number
  total_credit_extended: number
  bill_count: number
}

export interface ItemSalesLine {
  item_name: string
  variant_name: string | null
  unit_abbreviation: string
  total_qty: number
  total_revenue: number
}

export interface ItemReportRow {
  item_id: number
  item_name: string
  variant_id: number | null
  variant_name: string | null
  unit_abbreviation: string
  total_qty: number
  total_amount: number
}

export interface CustomerLedgerLine {
  id: number
  name: string
  phone: string | null
  total_billed: number
  total_paid: number
  outstanding: number
  last_bill_date: string | null
}

export interface BusinessSummary {
  /** Revenue per line type, exact from bill_lines (no pro-rating). */
  sales:      { count: number; total: number }
  processing: { count: number; total: number }
  /** Period cash. Not splittable by line type -- a payment has no line type. */
  cash_collected: number
  credit_extended: number
  /** Point-in-time, global, NOT period- or business-scoped. */
  receivable_now: number
  advance_held_now: number
  expenses:   { general: number; salary: number; total: number } | null
}

export interface ExpenseCategoryRow {
  id: number
  name: string
  is_active: number
}

export interface ExpenseRow {
  id: number
  category_id: number
  category_name: string
  amount: number
  description: string | null
  expense_date: string
  operator_id: number
  created_at: string
}

export interface CustomerLoanRow {
  id: number
  customer_id: number
  customer_name: string
  amount: number
  paid_amount: number
  due_amount: number
  description: string | null
  loan_date: string
  status: 'active' | 'cancelled'
  operator_id: number
  created_at: string
}

export interface EmployeeRow {
  id: number
  name: string
  phone: string | null
  position: string | null
  base_salary: number
  is_active: number
  created_at: string
}

export interface SalaryPaymentRow {
  id: number
  employee_id: number
  employee_name: string
  amount: number
  txn_type: 'salary' | 'advance' | 'bonus' | 'deduction'
  description: string | null
  paid_date: string
  cycle_id: number | null
  operator_id: number
  created_at: string
}

export interface EmployeeRemaining {
  base_salary: number
  total_deducted: number
  remaining: number
}

export interface EmployeeLoanRow {
  id: number
  employee_id: number
  amount: number
  paid_amount: number
  due_amount: number
  description: string | null
  loan_date: string
  status: 'active' | 'cancelled'
  operator_id: number
  created_at: string
}

export interface ElectronAPI {
  ping: () => Promise<string>

  users: {
    getAll: () => Promise<IpcResult<UserRow[]>>
    create: (username: string, pin: string, role: 'owner' | 'operator', requestedByUserId: number) => Promise<IpcResult<{ id: number }>>
    setActive: (id: number, active: boolean, requestedByUserId: number) => Promise<IpcResult>
    resetPin: (id: number, newPin: string, requestedByUserId: number) => Promise<IpcResult>
    rename: (id: number, newUsername: string, requestedByUserId: number) => Promise<IpcResult>
  }

  audit: {
    getAll: (limit?: number, offset?: number, filterAction?: string) => Promise<IpcResult<AuditLogRow[]>>
  }

  print: {
    pdf: () => Promise<IpcResult>
    window: () => Promise<IpcResult>
    receipt: (bill: BillWithCustomer, lines: BillLineWithDetail[], business: BusinessRow, printerIp?: string) => Promise<IpcResult>
    token: (business: BusinessRow, tokenNumber: number, itemName: string, createdAt: string, printerIp?: string) => Promise<IpcResult>
  }

  tokens: {
    generate: (businessId: number | null, itemId: number, operatorId: number) => Promise<IpcResult<{ tokenNumber: number; createdAt: string }>>
  }

  businesses: {
    getAll: () => Promise<IpcResult<BusinessRow[]>>
    create: (fields: { name: string; pan_number?: string; phone?: string; address?: string; bill_prefix: string }) => Promise<IpcResult<{ id: number }>>
    update: (id: number, fields: { name: string; pan_number?: string; phone?: string; address?: string; bill_prefix: string }) => Promise<IpcResult>
    delete: (id: number) => Promise<IpcResult>
  }

  suppliers: {
    getAll: () => Promise<IpcResult<SupplierRow[]>>
    search: (query: string) => Promise<IpcResult<SupplierRow[]>>
    create: (name: string, phone?: string, address?: string, notes?: string) => Promise<IpcResult<{ id: number }>>
    update: (id: number, name: string, phone?: string, address?: string, notes?: string) => Promise<IpcResult>
    deactivate: (id: number) => Promise<IpcResult>
  }

  purchases: {
    getAll: (limit?: number) => Promise<IpcResult<PurchaseWithSupplier[]>>
    getLines: (orderId: number) => Promise<IpcResult<PurchaseLineWithDetail[]>>
    create: (input: CreatePurchaseInput) => Promise<IpcResult<{ orderId: number }>>
  }

  dashboard: {
    getData: (businessId?: number) => Promise<IpcResult<DashboardData>>
    getSalesReport: (fromDate: string, toDate: string, businessId?: number) => Promise<IpcResult<SalesReport>>
    getItemSalesReport: (fromDate: string, toDate: string, businessId?: number) => Promise<IpcResult<ItemSalesLine[]>>
    getCustomerBalances: () => Promise<IpcResult<CustomerLedgerLine[]>>
    getItemReport: (billType: 'sale' | 'processing', fromDate: string, toDate: string, businessId?: number) => Promise<IpcResult<ItemReportRow[]>>
    getBusinessSummary: (fromDate: string, toDate: string, businessId?: number) => Promise<IpcResult<BusinessSummary>>
  }

  auth: {
    isFirstRun: () => Promise<IpcResult<boolean>>
    setupOwner: (username: string, pin: string) => Promise<IpcResult<{ userId: number; recoveryCode: string }>>
    login: (username: string, pin: string) => Promise<IpcResult<AuthUser>>
    changePin: (userId: number, currentPin: string, newPin: string) => Promise<IpcResult>
    recoverWithCode: (code: string, newPin: string) => Promise<IpcResult<AuthUser>>
    regenerateRecoveryCode: (userId: number, currentPin: string) => Promise<IpcResult<{ recoveryCode: string }>>
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
      filter?: { sellable?: boolean; buyable?: boolean; processable?: boolean; stockable?: boolean }
    ) => Promise<IpcResult<ItemRow[]>>
    create: (
      name: string,
      defaultUnitId: number,
      isBuyable: boolean,
      isSellable: boolean,
      isProcessable: boolean,
      enableToken?: boolean
    ) => Promise<IpcResult<{ id: number; variantId: number }>>
    update: (
      id: number,
      name: string,
      defaultUnitId: number,
      isBuyable: boolean,
      isSellable: boolean,
      isProcessable: boolean,
      enableToken?: boolean
    ) => Promise<IpcResult>
    deactivate: (id: number) => Promise<IpcResult>
    restore: (id: number) => Promise<IpcResult>
    setPriority: (id: number, priority: number | null) => Promise<IpcResult>
  }

  variants: {
    getByItem: (itemId: number) => Promise<IpcResult<VariantRow[]>>
    getById: (id: number) => Promise<IpcResult<VariantRow>>
    create: (itemId: number, name: string, isDefault: boolean) => Promise<IpcResult<{ id: number }>>
    update: (id: number, name: string, isDefault: boolean) => Promise<IpcResult>
    deactivate: (id: number) => Promise<IpcResult>
    getArchived: () => Promise<IpcResult<(VariantRow & { item_name: string })[]>>
    restore: (id: number) => Promise<IpcResult>
    setPriority: (id: number, priority: number | null) => Promise<IpcResult>
  }

  inventory: {
    getAll: () => Promise<IpcResult<StockLevel[]>>
    getByItem: (itemId: number) => Promise<IpcResult<StockLevel[]>>
    adjust: (
      itemId: number,
      variantId: number | null,
      unitId: number,
      newQty: number,
      operatorId: number,
      notes?: string
    ) => Promise<IpcResult>
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
    getAll: (activeOnly?: boolean) => Promise<IpcResult<CustomerWithBalance[]>>
    search: (query: string) => Promise<IpcResult<CustomerWithBalance[]>>
    getById: (id: number) => Promise<IpcResult<CustomerWithBalance>>
    create: (name: string, phone?: string, address?: string, notes?: string, panNumber?: string) => Promise<IpcResult<{ id: number }>>
    update: (id: number, name: string, phone?: string, address?: string, notes?: string, panNumber?: string) => Promise<IpcResult>
    deactivate: (id: number) => Promise<IpcResult>
    restore: (id: number) => Promise<IpcResult>
    receivePayment: (customerId: number, amount: number, method: string, operatorId: number, note?: string) => Promise<IpcResult>
  }

  bills: {
    getNextNumber: (businessId: number) => Promise<IpcResult<{ billNumber: string }>>
    getAll: (limit?: number, businessId?: number) => Promise<IpcResult<BillWithCustomer[]>>
    getById: (id: number) => Promise<IpcResult<BillWithCustomer>>
    getLines: (billId: number) => Promise<IpcResult<BillLineWithDetail[]>>
    getPayments: (billId: number) => Promise<IpcResult<LedgerEntryView[]>>
    getCustomerStatement: (customerId: number) => Promise<IpcResult<CustomerStatementEntry[]>>
    getCustomerItemLines: (customerId: number) => Promise<IpcResult<CustomerItemLine[]>>
    create: (input: CreateBillInput) => Promise<IpcResult<{ billId: number; billNumber: string }>>
    cancel: (billId: number, reason: string, operatorId: number) => Promise<IpcResult>
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
    runAdHocBatch: (input: AdHocBatchInput) => Promise<IpcResult<{ batchId: number }>>
    getRecentMillBatches: (limit?: number) => Promise<IpcResult<BatchWithRule[]>>
    getPresetsForItem: (inputItemId: number) => Promise<IpcResult<MillPreset[]>>
  }

  prices: {
    getAllCurrent: (priceType: 'sell' | 'processing') => Promise<IpcResult<PriceListEntry[]>>
    getCurrent: (itemId: number) => Promise<IpcResult<CurrentPrice[]>>
    getHistory: (
      itemId: number,
      variantId: number | null,
      priceType: 'sell' | 'buy' | 'processing'
    ) => Promise<IpcResult<PriceRow[]>>
    set: (
      itemId: number,
      variantId: number | null,
      unitId: number,
      price: number,
      priceType: 'sell' | 'buy' | 'processing',
      effectiveFrom: string
    ) => Promise<IpcResult<{ id: number }>>
  }

  expenses: {
    getCategories: () => Promise<IpcResult<ExpenseCategoryRow[]>>
    createCategory: (name: string, operatorId: number) => Promise<IpcResult<{ id: number }>>
    getAll: (fromDate?: string, toDate?: string) => Promise<IpcResult<ExpenseRow[]>>
    create: (categoryId: number, amount: number, operatorId: number, description?: string, expenseDate?: string) => Promise<IpcResult<{ id: number }>>
    delete: (id: number, operatorId: number) => Promise<IpcResult>
  }

  loans: {
    getByCustomer: (customerId: number) => Promise<IpcResult<CustomerLoanRow[]>>
    getAll: () => Promise<IpcResult<CustomerLoanRow[]>>
    create: (customerId: number, amount: number, operatorId: number, description?: string, loanDate?: string) => Promise<IpcResult<{ id: number }>>
  }

  salary: {
    getEmployees: (activeOnly?: boolean) => Promise<IpcResult<EmployeeRow[]>>
    createEmployee: (name: string, phone: string | undefined, position: string | undefined, operatorId: number, baseSalary?: number) => Promise<IpcResult<{ id: number }>>
    updateEmployee: (id: number, name: string, phone: string | undefined, position: string | undefined, operatorId: number, baseSalary?: number) => Promise<IpcResult>
    deactivateEmployee: (id: number, operatorId: number) => Promise<IpcResult>
    getPayments: (employeeId: number) => Promise<IpcResult<SalaryPaymentRow[]>>
    recordPayment: (employeeId: number, amount: number, txnType: string, operatorId: number, description?: string, paidDate?: string) => Promise<IpcResult<{ id: number }>>
    deletePayment: (id: number, operatorId: number) => Promise<IpcResult>
    getEmployeeLoans: (employeeId: number) => Promise<IpcResult<EmployeeLoanRow[]>>
    createEmployeeLoan: (employeeId: number, amount: number, operatorId: number, description?: string, loanDate?: string) => Promise<IpcResult<{ id: number }>>
    updateEmployeeLoan: (loanId: number, employeeId: number, amount: number, operatorId: number, description?: string, loanDate?: string) => Promise<IpcResult>
    recordLoanRepayment: (loanId: number, employeeId: number, amount: number, operatorId: number, paidDate?: string) => Promise<IpcResult>
    getRemaining: (employeeId: number) => Promise<IpcResult<EmployeeRemaining>>
    payRemaining: (employeeId: number, operatorId: number) => Promise<IpcResult<{ paid: number }>>
  }
}

export interface CustomerRow {
  id: number
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  pan_number: string | null
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
  business_id: number
  bill_number: string
  bill_type: 'sale' | 'processing'
  status: 'draft' | 'active' | 'cancelled'
  customer_id: number | null
  subtotal: number
  discount_amount: number
  grand_total: number
  /** Cash taken at the counter. Immutable historical fact about this transaction. */
  paid_amount: number
  /** Portion of this bill that went to credit. Immutable. */
  credit_amount: number
  notes: string | null
  operator_id: number
  created_at: string
  cancel_reason: string | null
  cancelled_at: string | null
  amends_bill_id: number | null
}

export interface BillWithCustomer extends BillRow {
  business_name: string
  customer_name: string | null
  customer_phone: string | null
  customer_address: string | null
  customer_pan: string | null
  bill_kind: 'sale' | 'processing' | 'mixed'
  amends_bill_number: string | null
  superseded_by_bill_number: string | null
  /** Balance before this bill. NULL for walk-ins / first transaction. */
  khata_prev_balance: number | null
  /** Balance after this bill. NULL for walk-ins. */
  khata_new_balance: number | null
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
  lineType: 'sale' | 'processing'
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
  line_type: 'sale' | 'processing'
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

export interface MillPreset {
  id: number
  output_item_id: number
  output_item_name: string
  output_unit_id: number
  output_unit_abbreviation: string
  default_yield_pct: number
  is_byproduct: number
  sort_order: number
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

export interface AdHocBatchOutput {
  outputItemId: number
  outputVariantId: number | null
  outputUnitId: number
  yieldPct: number
  actualQty: number
}

export interface AdHocBatchInput {
  inputItemId: number
  inputVariantId: number | null
  inputUnitId: number
  inputQty: number
  outputs: AdHocBatchOutput[]
  notes?: string
  operatorId: number
}

export interface CreateBillInput {
  businessId: number
  customerId: number | null
  lines: BillLineInput[]
  discountAmount: number
  paidAmount: number
  paymentMethod: 'cash' | 'bank' | 'digital' | 'credit'
  notes?: string
  operatorId: number
  amendsBillId?: number | null
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

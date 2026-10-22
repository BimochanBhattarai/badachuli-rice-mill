import Database from 'better-sqlite3'
import { getCashCollected, LEDGER_CHARGES_SQL, LEDGER_PAID_SQL } from './ledger.repo'

export interface TodaySummary {
  bill_count: number
  total_billed: number
  /** Counter cash + debt collected today. */
  total_collected: number
  /** The debt-collection share of total_collected (payments against the balance). */
  debt_collected: number
  new_udharo: number
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

export function getDashboardData(db: Database.Database, businessId?: number): DashboardData {
  const today = new Date().toISOString().slice(0, 10)
  const bizFilter = businessId ? `AND business_id = ${businessId}` : ''

  const billRow = db.prepare(
    `SELECT
       COUNT(*)                        as bill_count,
       COALESCE(SUM(grand_total), 0)   as total_billed,
       COALESCE(SUM(credit_amount), 0) as new_udharo
     FROM bills
     WHERE status = 'active'
       AND DATE(created_at) = ? ${bizFilter}`
  ).get(today) as Omit<TodaySummary, 'total_collected' | 'debt_collected'>

  // Money collected today is NOT just bills.paid_amount. A customer paying down their
  // balance writes a ledger row with no bill at all, so summing the bills table alone
  // made debt collection invisible on the dashboard.
  const cash = getCashCollected(db, today, today, businessId)

  const todayRow: TodaySummary = {
    ...billRow,
    total_collected: cash.total,
    debt_collected: cash.debt,
  }

  // Global receivable, straight off the running balances. Previously this summed only
  // TODAY's bills while the dashboard displayed it as the overall outstanding total.
  // Deliberately NOT business-scoped: there is one balance per customer, not one per
  // business, so this is an all-businesses figure by construction.
  const outstandingRow = db.prepare(
    `SELECT COALESCE(SUM(balance), 0) as total FROM customers WHERE balance > 0.005`
  ).get() as { total: number }

  const stockRow = db.prepare(
    `SELECT COUNT(DISTINCT item_id) as cnt FROM inventory_transactions`
  ).get() as { cnt: number }

  const batchRow = db.prepare(
    `SELECT COUNT(*) as cnt FROM processing_batches WHERE DATE(created_at) = ?`
  ).get(today) as { cnt: number }

  const weeklySales = db.prepare(
    `SELECT DATE(created_at) as date, COALESCE(SUM(grand_total), 0) as total
     FROM bills
     WHERE status = 'active'
       AND DATE(created_at) >= DATE('now', '-6 days') ${bizFilter}
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  ).all() as WeeklySalesDay[]

  const salesMap = new Map(weeklySales.map(r => [r.date, r.total]))
  const weekly_sales: WeeklySalesDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().slice(0, 10)
    return { date: dateStr, total: salesMap.get(dateStr) ?? 0 }
  })

  return {
    today: todayRow,
    total_outstanding: outstandingRow.total,
    stock_item_count: stockRow.cnt,
    processing_batches_today: batchRow.cnt,
    weekly_sales,
  }
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

export function getSalesReport(
  db: Database.Database,
  fromDate: string,
  toDate: string,
  businessId?: number
): SalesReport {
  const bizFilter = businessId ? `AND b.business_id = ${businessId}` : ''
  const lines = db.prepare(
    `SELECT b.bill_number, b.created_at, c.name as customer_name,
       b.grand_total, b.paid_amount, b.credit_amount, b.status
     FROM bills b
     LEFT JOIN customers c ON c.id = b.customer_id
     WHERE b.status = 'active'
       AND DATE(b.created_at) BETWEEN ? AND ? ${bizFilter}
     ORDER BY b.created_at DESC`
  ).all(fromDate, toDate) as SalesReportLine[]

  return {
    lines,
    total_billed:      lines.reduce((s, l) => s + l.grand_total, 0),
    total_collected:   lines.reduce((s, l) => s + l.paid_amount, 0),
    total_credit_extended: lines.reduce((s, l) => s + l.credit_amount, 0),
    bill_count: lines.length,
  }
}

export interface ItemSalesLine {
  item_name: string
  variant_name: string | null
  unit_abbreviation: string
  total_qty: number
  total_revenue: number
}

export function getItemSalesReport(
  db: Database.Database,
  fromDate: string,
  toDate: string,
  businessId?: number
): ItemSalesLine[] {
  const bizFilter = businessId ? `AND b.business_id = ${businessId}` : ''
  return db.prepare(
    `SELECT i.name as item_name, v.name as variant_name, u.abbreviation as unit_abbreviation,
       SUM(bl.qty)        as total_qty,
       SUM(bl.line_total) as total_revenue
     FROM bill_lines bl
     JOIN bills b ON b.id = bl.bill_id
     JOIN items i ON i.id = bl.item_id
     LEFT JOIN variants v ON v.id = bl.variant_id
     JOIN units u ON u.id = bl.unit_id
     WHERE b.status = 'active'
       AND DATE(b.created_at) BETWEEN ? AND ? ${bizFilter}
     GROUP BY bl.item_id, bl.variant_id, bl.unit_id
     ORDER BY total_revenue DESC`
  ).all(fromDate, toDate) as ItemSalesLine[]
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

export function getItemReport(
  db: Database.Database,
  billType: 'sale' | 'processing',
  fromDate: string,
  toDate: string,
  businessId?: number
): ItemReportRow[] {
  const bizFilter = businessId ? `AND b.business_id = ${businessId}` : ''
  return db.prepare(
    `SELECT
       i.id   as item_id,
       i.name as item_name,
       v.id   as variant_id,
       v.name as variant_name,
       u.abbreviation as unit_abbreviation,
       SUM(bl.qty)        as total_qty,
       SUM(bl.line_total) as total_amount
     FROM bill_lines bl
     JOIN bills b ON b.id = bl.bill_id
     JOIN items i ON i.id = bl.item_id
     LEFT JOIN variants v ON v.id = bl.variant_id
     JOIN units u ON u.id = bl.unit_id
     WHERE b.status = 'active'
       AND bl.line_type = ?
       AND DATE(b.created_at) BETWEEN ? AND ?
       ${bizFilter}
     GROUP BY bl.item_id, bl.variant_id
     ORDER BY i.name, COALESCE(v.name, '')`
  ).all(billType, fromDate, toDate) as ItemReportRow[]
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

export function getBusinessSummary(
  db: Database.Database,
  fromDate: string,
  toDate: string,
  businessId?: number
): BusinessSummary {
  const bizFilter = businessId ? `AND business_id = ${businessId}` : ''

  // Revenue per line type is exact -- bill_lines already carry line_total, so nothing
  // needs pro-rating. The old query divided bill-level paid_amount/due_amount by
  // line_total/subtotal to fake a per-line-type split; under balance-forward there is no
  // per-bill paid figure to pro-rate at all, so cash and credit move out of these cards.
  const rows = db.prepare(
    `SELECT bl.line_type,
            COUNT(DISTINCT b.id)                 AS count,
            COALESCE(SUM(bl.line_total), 0)      AS total
     FROM bill_lines bl
     JOIN bills b ON b.id = bl.bill_id
     WHERE b.status = 'active'
       AND DATE(b.created_at) BETWEEN ? AND ?
       ${bizFilter}
     GROUP BY bl.line_type`
  ).all(fromDate, toDate) as { line_type: string; count: number; total: number }[]

  const cash = getCashCollected(db, fromDate, toDate, businessId)

  const creditRow = db.prepare(
    `SELECT COALESCE(SUM(credit_amount), 0) AS v FROM bills
      WHERE status = 'active' AND DATE(created_at) BETWEEN ? AND ? ${bizFilter}`
  ).get(fromDate, toDate) as { v: number }

  // Point-in-time, global, NOT period- or business-scoped.
  const nowRow = db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN balance > 0.005 THEN balance END), 0)  AS receivable,
            COALESCE(-SUM(CASE WHEN balance < -0.005 THEN balance END), 0) AS advance
       FROM customers`
  ).get() as { receivable: number; advance: number }

  const zero = { count: 0, total: 0 }
  const sales      = rows.find(r => r.line_type === 'sale')      ?? zero
  const processing = rows.find(r => r.line_type === 'processing') ?? zero

  let expenses: BusinessSummary['expenses'] = null
  if (!businessId) {
    const { general } = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS general FROM expenses
       WHERE expense_date BETWEEN ? AND ?`
    ).get(fromDate, toDate) as { general: number }

    const { salary } = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS salary FROM salary_payments
       WHERE txn_type IN ('salary','advance','bonus') AND paid_date BETWEEN ? AND ?`
    ).get(fromDate, toDate) as { salary: number }

    expenses = { general, salary, total: general + salary }
  }

  return {
    sales,
    processing,
    cash_collected: cash.total,
    credit_extended: creditRow.v,
    receivable_now: nowRow.receivable,
    advance_held_now: nowRow.advance,
    expenses,
  }
}

export function getCustomerBalances(db: Database.Database): CustomerLedgerLine[] {
  return db.prepare(
    `SELECT c.id, c.name, c.phone,
       ${LEDGER_CHARGES_SQL} as total_billed,
       ${LEDGER_PAID_SQL} as total_paid,
       c.balance as outstanding,
       MAX(b.created_at) as last_bill_date
     FROM customers c
     LEFT JOIN bills b ON b.customer_id = c.id AND b.status = 'active'
     WHERE c.is_active = 1
     GROUP BY c.id
     ORDER BY outstanding DESC, c.name`
  ).all() as CustomerLedgerLine[]
}

import Database from 'better-sqlite3'

export interface TodaySummary {
  bill_count: number
  total_billed: number
  total_collected: number
  new_udharo: number
}

export interface WeeklySalesDay {
  date: string
  total: number
}

export interface DashboardData {
  today: TodaySummary
  total_outstanding: number
  stock_item_count: number
  processing_batches_today: number
  weekly_sales: WeeklySalesDay[]
}

export function getDashboardData(db: Database.Database, businessId?: number): DashboardData {
  const today = new Date().toISOString().slice(0, 10)
  const bizFilter = businessId ? `AND business_id = ${businessId}` : ''

  const todayRow = db.prepare(
    `SELECT
       COUNT(*)              as bill_count,
       COALESCE(SUM(grand_total), 0)   as total_billed,
       COALESCE(SUM(paid_amount), 0)   as total_collected,
       COALESCE(SUM(due_amount), 0)    as new_udharo
     FROM bills
     WHERE status = 'active'
       AND DATE(created_at) = ? ${bizFilter}`
  ).get(today) as TodaySummary

  const outstandingRow = db.prepare(
    `SELECT COALESCE(SUM(due_amount), 0) as total
     FROM bills WHERE status = 'active' ${bizFilter}`
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
  due_amount: number
  status: string
}

export interface SalesReport {
  lines: SalesReportLine[]
  total_billed: number
  total_collected: number
  total_outstanding: number
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
       b.grand_total, b.paid_amount, b.due_amount, b.status
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
    total_outstanding: lines.reduce((s, l) => s + l.due_amount, 0),
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

export interface CustomerLedgerLine {
  id: number
  name: string
  phone: string | null
  total_billed: number
  total_paid: number
  outstanding: number
  last_bill_date: string | null
}

export function getCustomerLedger(db: Database.Database): CustomerLedgerLine[] {
  return db.prepare(
    `SELECT c.id, c.name, c.phone,
       COALESCE(SUM(b.grand_total), 0) as total_billed,
       COALESCE(SUM(b.paid_amount), 0) as total_paid,
       COALESCE(SUM(b.due_amount),  0) as outstanding,
       MAX(b.created_at) as last_bill_date
     FROM customers c
     LEFT JOIN bills b ON b.customer_id = c.id AND b.status = 'active'
     WHERE c.is_active = 1
     GROUP BY c.id
     ORDER BY outstanding DESC, c.name`
  ).all() as CustomerLedgerLine[]
}

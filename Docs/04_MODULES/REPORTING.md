# Module — Reporting

## 1. Purpose

The Reporting module provides the owner with actionable financial and operational insight by computing views over the transaction ledger. All report figures are derived from `bills`, `bill_lines`, `payments`, `inventory_transactions`, `processing_transactions`, and `expenses` at query time — they are never drawn from independently maintained summary counters.

---

## 2. Core Principle

> **A report figure is only trustworthy if it equals what you would get by manually summing every relevant transaction.**

Materialized caches are permitted for performance but must be rebuildable from the raw ledger at any time and produce identical results. The system includes a "Verify Report Integrity" admin function that does exactly this check.

---

## 3. Report List

### 3.1 Sales Report

| Element | Detail |
|---|---|
| **Purpose** | How much the mill sold, to whom, and how much is still owed |
| **Key Metrics** | Total revenue, bill count, total qty sold, total paid, total due (udharo) |
| **Groupings** | By day / by customer / by item / by payment method |
| **Filters** | Date range (AD or BS), customer, item, payment status (paid/due/all), bill type |

**SQL sketch:**
```sql
SELECT
  DATE(b.bill_date_ad)         AS date,
  COUNT(*)                     AS bill_count,
  SUM(b.grand_total)           AS total_billed,
  SUM(b.paid_amount)           AS total_paid,
  SUM(b.due_amount)            AS total_due
FROM bills b
WHERE b.status = 'active'
  AND b.bill_date_ad BETWEEN :from AND :to
GROUP BY DATE(b.bill_date_ad)
ORDER BY date;
```

---

### 3.2 Processing Report

| Element | Detail |
|---|---|
| **Purpose** | Mill throughput, yield efficiency, and processing income |
| **Key Metrics** | Total input processed (kg), output by item, average yield %, waste %, processing income |
| **Groupings** | By mode (in-house / customer), by rule, by item, by day |
| **Filters** | Date range, processing mode, rule, customer |

**SQL sketch:**
```sql
SELECT
  pt.mode,
  pr.name                                     AS rule_name,
  SUM(pt.input_qty)                           AS total_input_kg,
  AVG(
    json_extract(pt.actual_outputs_json,'$[0].qty')
    / pt.input_qty * 100
  )                                           AS avg_yield_pct,
  SUM(COALESCE(pt.processing_charge, 0))      AS total_processing_income
FROM processing_transactions pt
JOIN processing_rules pr ON pr.id = pt.rule_id
WHERE DATE(pt.processed_at) BETWEEN :from AND :to
GROUP BY pt.mode, pr.id;
```

---

### 3.3 Inventory Report

| Element | Detail |
|---|---|
| **Purpose** | Stock movement and closing balances for every item |
| **Structure** | Opening stock + In − Out ± Adjustments = Closing stock per item/variant/category |
| **Filters** | Date range, item, stock category |

The "opening stock for a period" is computed as `SUM(qty_delta)` for all transactions *before* the period start. Closing is the sum through the period end. This gives a correct opening/closing even for any arbitrary date range.

```sql
-- Opening stock for item X in category C as of :from_date
SELECT SUM(qty_delta) AS opening
FROM inventory_transactions
WHERE item_id = :item_id AND stock_category = :category
  AND created_at < :from_date;

-- Movements during the period
SELECT tx_type, SUM(qty_delta) AS qty
FROM inventory_transactions
WHERE item_id = :item_id AND stock_category = :category
  AND created_at BETWEEN :from_date AND :to_date
GROUP BY tx_type;
```

---

### 3.4 Product Report

| Element | Detail |
|---|---|
| **Purpose** | Which items/variants are selling, and how much |
| **Key Metrics** | Qty sold, revenue, avg. selling price, number of bills, top customers per item |
| **Filters** | Date range, item, variant |

---

### 3.5 Customer Report

| Element | Detail |
|---|---|
| **Purpose** | Customer purchase history, outstanding balances, credit aging |
| **Key Metrics** | Total billed, total paid, outstanding balance, last purchase date |
| **Aging Buckets** | 0–30 days due, 31–60 days due, 61–90 days due, 90+ days due |
| **Filters** | Date range, customer, balance status (all / has due / fully paid) |

**Aging query:**
```sql
SELECT
  c.name,
  SUM(b.due_amount)   FILTER (WHERE julianday('now') - julianday(b.bill_date_ad) <= 30) AS bucket_0_30,
  SUM(b.due_amount)   FILTER (WHERE julianday('now') - julianday(b.bill_date_ad) BETWEEN 31 AND 60) AS bucket_31_60,
  SUM(b.due_amount)   FILTER (WHERE julianday('now') - julianday(b.bill_date_ad) BETWEEN 61 AND 90) AS bucket_61_90,
  SUM(b.due_amount)   FILTER (WHERE julianday('now') - julianday(b.bill_date_ad) > 90) AS bucket_90_plus
FROM bills b
JOIN customers c ON c.id = b.customer_id
WHERE b.status = 'active' AND b.due_amount > 0
GROUP BY c.id;
```

---

### 3.6 Supplier Report

| Element | Detail |
|---|---|
| **Purpose** | Purchasing history per supplier and outstanding payables |
| **Key Metrics** | Total purchased (qty + cost), total paid, outstanding payable balance |
| **Filters** | Date range, supplier |

---

### 3.7 Expense Report

| Element | Detail |
|---|---|
| **Purpose** | Mill operating costs by category and time period |
| **Key Metrics** | Total expenses, breakdown by category |
| **Filters** | Date range, expense category |

---

### 3.8 Financial Summary (P&L Overview)

| Line Item | Source |
|---|---|
| Gross Sales Revenue | `SUM(bills.grand_total) WHERE status='active'` |
| Returns / Cancellations | `SUM(bills.grand_total) WHERE status='cancelled'` |
| Net Sales Revenue | Gross − Returns |
| Processing Income | `SUM(processing_transactions.processing_charge) WHERE mode='customer'` |
| Total Income | Net Sales + Processing Income |
| Cost of Goods (approx.) | `SUM(stock_ins.total_cost)` for items consumed in the period |
| Operating Expenses | `SUM(expenses.amount)` |
| **Net Profit (approx.)** | Total Income − COGS − Expenses |

The "approx." note is important — true cost of goods requires FIFO/WAC costing which is Phase 2. Phase 1 uses purchase cost as a rough proxy.

---

## 4. Common Report Features

All reports share:

| Feature | Specification |
|---|---|
| Date range selector | Daily, Weekly, Monthly, Quarterly, Yearly presets + custom range |
| Calendar | AD (Gregorian) or BS (Bikram Sambat) date picker |
| Print | Print the report summary directly from the app |
| Export — PDF | Layout-accurate PDF via `@react-pdf/renderer` |
| Export — XLSX | Structured spreadsheet via `exceljs`; suitable for accountant handoff |
| Export — CSV | Simple CSV for import into other tools |

---

## 5. Performance Considerations

| Scenario | Approach |
|---|---|
| Reports on < 1 year of data | Direct SQL aggregates; no caching needed |
| Reports on 2–5 years of data | Add a composite index on `(bill_date_ad, customer_id)` and `(created_at, item_id)` in migrations |
| Dashboard summary tiles | Cached: a `daily_summary` materialized table is updated on each transaction write. Falls back to full-table scan if the cache is stale. |
| Large XLSX exports | Streamed row-by-row using `exceljs` streaming API to avoid holding the full dataset in memory |

---

## 6. Dashboard Tiles (Summary)

The dashboard shows real-time (auto-refreshing) summary tiles:

| Tile | Query |
|---|---|
| Today's Sales | `SUM(grand_total) FROM bills WHERE date = today AND status = 'active'` |
| Today's Bill Count | `COUNT(*) FROM bills WHERE date = today AND status = 'active'` |
| Total Outstanding Due | `SUM(due_amount) FROM bills WHERE status = 'active' AND due_amount > 0` |
| Today's Processing | `COUNT(*) FROM processing_transactions WHERE date = today` |
| Low Stock Items | `COUNT(*) FROM (SELECT item_id WHERE current_stock ≤ reorder_threshold)` |
| Recent 10 Transactions | Latest 10 rows across bills + processing_transactions, ordered by created_at |

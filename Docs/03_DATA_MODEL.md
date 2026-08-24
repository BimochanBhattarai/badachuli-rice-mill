# 03 — Data Model

## 1. Design Philosophy

The data model has one governing principle: **the transaction ledger is the single source of truth.**

- Stock levels are **computed** as `SUM(qty_delta)` over `inventory_transactions`. They are never stored as independently editable running totals.
- Customer outstanding balances are **computed** from `bills` and `payments`. Never stored as an editable field.
- Report totals are **computed** from the ledger at query time. Never maintained in a separate summary table (materialized caches for performance are acceptable but must always be rebuildable from the ledger with identical results).
- Completed transactions are **never deleted**. Cancellations add compensating rows. This makes every historical state reconstructible.

Violating this principle — even once, "just for simplicity" — breaks report accuracy, audit correctness, and crash-recovery guarantees. Do not compromise on it.

---

## 2. Entity Overview

| # | Table | Category | Purpose |
|---|---|---|---|
| 1 | `users` | Auth | Application operators |
| 2 | `roles` | Auth | Named permission groups |
| 3 | `permissions` | Auth | Individual permission keys |
| 4 | `role_permissions` | Auth | Many-to-many: roles ↔ permissions |
| 5 | `user_roles` | Auth | Many-to-many: users ↔ roles |
| 6 | `items` | Catalog | Raw materials, products, by-products |
| 7 | `variants` | Catalog | Sellable forms of an item |
| 8 | `units` | Catalog | Measurement units with conversion |
| 9 | `item_units` | Catalog | Allowed units per item with conversion ratio |
| 10 | `prices` | Catalog | Versioned price history |
| 11 | `processing_rules` | Processing | Configurable input→output recipes |
| 12 | `processing_rule_outputs` | Processing | Output lines of a processing rule |
| 13 | `processing_transactions` | Processing | Executed processing events |
| 14 | `customers` | Sales | Customer master data |
| 15 | `suppliers` | Purchasing | Supplier master data |
| 16 | `bills` | Sales | Sale / processing bill header. For customer processing, grand_total may be NRs 0 (charge waived) but a bill is always generated and printed as a work-order authorization token. |
| 17 | `bill_lines` | Sales | Individual line items on a bill |
| 18 | `payments` | Sales | Payment events against bills |
| 19 | `stock_ins` | Inventory | Raw material received from supplier |
| 20 | `inventory_transactions` | Inventory | Universal stock movement ledger |
| 21 | `stock_adjustments` | Inventory | Manual stock corrections |
| 22 | `expenses` | Finance | Mill expense records |
| 23 | `expense_categories` | Finance | Owner-configurable expense categories |
| 24 | `audit_log` | Audit | Append-only tamper-evident action trail |
| 25 | `backups` | System | Backup run history |
| 26 | `settings` | System | Key-value application configuration |

---

## 3. Full SQL DDL

### Authentication & RBAC

```sql
CREATE TABLE users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT    NOT NULL,
  display_name   TEXT    NOT NULL,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  description TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE permissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT    NOT NULL UNIQUE,  -- e.g. 'CREATE_BILL', 'CANCEL_BILL'
  description TEXT
);

CREATE TABLE role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
```

### Item Catalog

```sql
CREATE TABLE units (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT    NOT NULL,         -- e.g. 'Kilogram'
  symbol             TEXT    NOT NULL UNIQUE,  -- e.g. 'kg'
  base_unit_id       INTEGER REFERENCES units(id), -- NULL = this is a base unit
  to_base_factor     NUMERIC NOT NULL DEFAULT 1,   -- 1 kg = 1 kg; 1 Bora = 50 kg
  active             INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE items (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT    NOT NULL,
  is_raw_material    INTEGER NOT NULL DEFAULT 0,
  is_processed       INTEGER NOT NULL DEFAULT 0,
  is_sellable        INTEGER NOT NULL DEFAULT 0,
  is_byproduct       INTEGER NOT NULL DEFAULT 0,
  stocking_unit_id   INTEGER NOT NULL REFERENCES units(id),
  reorder_threshold  NUMERIC NOT NULL DEFAULT 0,
  allow_negative_stock INTEGER NOT NULL DEFAULT 0,
  description        TEXT,
  active             INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE variants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     INTEGER NOT NULL REFERENCES items(id),
  name        TEXT    NOT NULL,
  sku         TEXT    UNIQUE,
  is_default  INTEGER NOT NULL DEFAULT 0,  -- 1 for the auto-generated default variant
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (item_id, name)
);

-- Allowed transaction-entry units per item, with the conversion ratio to the stocking unit
CREATE TABLE item_units (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id           INTEGER NOT NULL REFERENCES items(id),
  unit_id           INTEGER NOT NULL REFERENCES units(id),
  to_stocking_factor NUMERIC NOT NULL,  -- 1 Bora of this item = 50 kg stocking unit
  UNIQUE (item_id, unit_id)
);
```

### Pricing

```sql
CREATE TABLE prices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id        INTEGER NOT NULL REFERENCES items(id),
  variant_id     INTEGER          REFERENCES variants(id),
  price_type     TEXT    NOT NULL CHECK (price_type IN (
                   'purchase', 'selling', 'processing',
                   'cost', 'wholesale', 'retail'
                 )),
  value          NUMERIC NOT NULL CHECK (value >= 0),
  effective_from TEXT    NOT NULL,
  effective_to   TEXT,            -- NULL = currently active
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_prices_lookup ON prices (item_id, variant_id, price_type, effective_from);
```

### Processing Rules

```sql
CREATE TABLE processing_rules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  input_item_id   INTEGER NOT NULL REFERENCES items(id),
  input_unit_id   INTEGER NOT NULL REFERENCES units(id),
  reference_qty   NUMERIC NOT NULL,   -- e.g. 100 (means: per 100 kg input)
  active          INTEGER NOT NULL DEFAULT 1,
  effective_from  TEXT    NOT NULL,
  effective_to    TEXT,
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE processing_rule_outputs (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id               INTEGER NOT NULL REFERENCES processing_rules(id),
  output_item_id        INTEGER NOT NULL REFERENCES items(id),
  output_variant_id     INTEGER          REFERENCES variants(id),
  qty_or_pct            NUMERIC NOT NULL,           -- quantity per reference_qty input
  is_percentage         INTEGER NOT NULL DEFAULT 0, -- 1 = qty_or_pct is a percentage
  is_waste              INTEGER NOT NULL DEFAULT 0,
  is_byproduct          INTEGER NOT NULL DEFAULT 0,
  -- Byproduct disposition and in-kind payment configuration
  default_disposition   TEXT    NOT NULL DEFAULT 'customer_takes'
                        CHECK (default_disposition IN (
                          'mill_keeps',      -- always retained by mill (e.g., Bhus/husk)
                          'customer_takes',  -- always returned to customer (e.g., Chamal, Tel)
                          'operator_decides' -- operator chooses per transaction (e.g., Dhuto, Pina)
                        )),
  waives_charge_if_left INTEGER NOT NULL DEFAULT 0, -- 1 = leaving this = free processing
  sort_order            INTEGER NOT NULL DEFAULT 0
);
```

### Processing Transactions

```sql
CREATE TABLE processing_transactions (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id              INTEGER NOT NULL REFERENCES processing_rules(id),
  mode                 TEXT    NOT NULL CHECK (mode IN ('in_house', 'customer')),
  input_item_id        INTEGER NOT NULL REFERENCES items(id),
  input_qty            NUMERIC NOT NULL,
  input_unit_id        INTEGER NOT NULL REFERENCES units(id),
  -- Expected outputs (calculated from rule at transaction time)
  expected_outputs_json TEXT   NOT NULL,  -- [{item_id, variant_id, qty, is_waste, is_byproduct}]
  -- Actual outputs (operator-entered; may differ from expected)
  actual_outputs_json  TEXT   NOT NULL,
  -- Customer Processing fields (NULL for in_house)
  customer_id          INTEGER          REFERENCES customers(id),
  processing_charge    NUMERIC,         -- 0 if charge waived by byproduct offset
  charge_waived        INTEGER NOT NULL DEFAULT 0, -- 1 = byproduct left = free processing
  dispositions_json    TEXT    NOT NULL DEFAULT '{}',
  -- Format: {"<output_item_id>": "mill_keeps"|"customer_takes"}
  -- Only populated for 'operator_decides' outputs
  bill_id              INTEGER          REFERENCES bills(id), -- always set for customer mode; NULL for in_house only
  -- Metadata
  operator_id          INTEGER NOT NULL REFERENCES users(id),
  notes                TEXT,
  processed_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### Customers & Suppliers

```sql
CREATE TABLE customers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  phone         TEXT,
  address       TEXT,
  notes         TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
-- outstanding_balance = SUM(bills.grand_total WHERE customer_id)
--                     - SUM(payments.amount WHERE customer_id)
-- Never stored; always computed.

CREATE INDEX idx_customers_phone ON customers (phone);

CREATE TABLE suppliers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  phone         TEXT,
  address       TEXT,
  notes         TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### Bills & Payments

```sql
CREATE TABLE bills (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_no         TEXT    NOT NULL UNIQUE,  -- e.g. 'BRM-2081-00142'
  bill_type       TEXT    NOT NULL DEFAULT 'sale' CHECK (bill_type IN ('sale', 'processing')),
  bill_date_ad    TEXT    NOT NULL,         -- ISO 8601: '2024-08-15'
  bill_date_bs    TEXT    NOT NULL,         -- Nepali: '2081-04-31'
  customer_id     INTEGER          REFERENCES customers(id),  -- NULL = walk-in
  subtotal        NUMERIC NOT NULL,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  taxable_amount  NUMERIC NOT NULL DEFAULT 0,
  vat_rate        NUMERIC NOT NULL DEFAULT 0,  -- 0 if VAT disabled or exempt
  vat_amount      NUMERIC NOT NULL DEFAULT 0,
  grand_total     NUMERIC NOT NULL,
  paid_amount     NUMERIC NOT NULL DEFAULT 0,
  due_amount      NUMERIC NOT NULL DEFAULT 0,  -- grand_total - paid_amount
  payment_method  TEXT             CHECK (payment_method IN ('cash', 'bank', 'digital', 'credit', 'mixed')),
  status          TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'draft')),
  cancelled_by    INTEGER          REFERENCES users(id),
  cancelled_at    TEXT,
  cancel_reason   TEXT,
  operator_id     INTEGER NOT NULL REFERENCES users(id),
  notes           TEXT,
  is_reprinted    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_bills_date    ON bills (bill_date_ad);
CREATE INDEX idx_bills_customer ON bills (customer_id);
CREATE INDEX idx_bills_status   ON bills (status);

CREATE TABLE bill_lines (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id        INTEGER NOT NULL REFERENCES bills(id),
  item_id        INTEGER NOT NULL REFERENCES items(id),
  variant_id     INTEGER NOT NULL REFERENCES variants(id),
  qty            NUMERIC NOT NULL CHECK (qty > 0),
  unit_id        INTEGER NOT NULL REFERENCES units(id),
  rate_snapshot  NUMERIC NOT NULL,  -- price at time of bill; NEVER updated after save
  discount_pct   NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  line_total     NUMERIC NOT NULL,
  is_taxable     INTEGER NOT NULL DEFAULT 0,
  sort_order     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id     INTEGER          REFERENCES bills(id),
  customer_id INTEGER          REFERENCES customers(id),
  amount      NUMERIC NOT NULL CHECK (amount > 0),
  method      TEXT    NOT NULL CHECK (method IN ('cash', 'bank', 'digital', 'credit', 'byproduct_offset')),
  -- 'byproduct_offset': customer left a byproduct; processing charge waived; amount = 0
  reference   TEXT,     -- bank/digital transaction reference number
  notes       TEXT,
  operator_id INTEGER NOT NULL REFERENCES users(id),
  paid_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### Inventory Ledger

```sql
CREATE TABLE stock_ins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       INTEGER NOT NULL REFERENCES items(id),
  variant_id    INTEGER NOT NULL REFERENCES variants(id),
  supplier_id   INTEGER          REFERENCES suppliers(id),
  qty           NUMERIC NOT NULL CHECK (qty > 0),
  unit_id       INTEGER NOT NULL REFERENCES units(id),
  qty_in_base   NUMERIC NOT NULL,  -- qty converted to stocking unit
  purchase_rate NUMERIC,           -- price paid per stocking unit
  total_cost    NUMERIC,
  notes         TEXT,
  operator_id   INTEGER NOT NULL REFERENCES users(id),
  received_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Universal stock movement ledger
-- Every stock change — sale, return, processing, adjustment, stock-in — writes a row here.
CREATE TABLE inventory_transactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id         INTEGER NOT NULL REFERENCES items(id),
  variant_id      INTEGER NOT NULL REFERENCES variants(id),
  stock_category  TEXT    NOT NULL CHECK (stock_category IN (
                    'raw_material', 'in_process', 'finished', 'byproduct'
                  )),
  tx_type         TEXT    NOT NULL CHECK (tx_type IN (
                    'stock_in', 'processed_in', 'processed_out',
                    'sale', 'return', 'adjustment', 'opening'
                  )),
  qty_delta       NUMERIC NOT NULL,  -- positive = stock added; negative = stock removed
  ref_type        TEXT,              -- 'bill', 'processing', 'stock_in', 'adjustment'
  ref_id          INTEGER,           -- FK to the relevant source record
  operator_id     INTEGER NOT NULL REFERENCES users(id),
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_inv_item_variant ON inventory_transactions (item_id, variant_id, stock_category);
CREATE INDEX idx_inv_created      ON inventory_transactions (created_at);

CREATE TABLE stock_adjustments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       INTEGER NOT NULL REFERENCES items(id),
  variant_id    INTEGER NOT NULL REFERENCES variants(id),
  stock_category TEXT   NOT NULL,
  qty_delta     NUMERIC NOT NULL,  -- positive = add; negative = remove
  reason_code   TEXT    NOT NULL CHECK (reason_code IN (
                  'damage', 'spillage', 'recount', 'expiry', 'theft', 'other'
                )),
  reason_note   TEXT,
  operator_id   INTEGER NOT NULL REFERENCES users(id),
  adjusted_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### Expenses

```sql
CREATE TABLE expense_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,  -- 'Fuel', 'Electricity', 'Labor', etc.
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  amount      NUMERIC NOT NULL CHECK (amount > 0),
  expense_date TEXT   NOT NULL,
  description TEXT,
  reference   TEXT,    -- receipt/voucher number
  operator_id INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_expenses_date ON expenses (expense_date);
```

### Audit & System

```sql
-- Append-only. No UPDATE or DELETE is ever issued against this table by the application.
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    INTEGER NOT NULL REFERENCES users(id),
  action      TEXT    NOT NULL,   -- 'BILL_CREATED', 'BILL_CANCELLED', 'STOCK_ADJUSTED', ...
  entity      TEXT,               -- table name of the affected entity
  entity_id   INTEGER,
  before_json TEXT,               -- serialized before-state (for edits/cancellations)
  after_json  TEXT,               -- serialized after-state
  reason      TEXT,               -- required for sensitive actions
  ip_address  TEXT,               -- future-proofing for multi-terminal
  prev_hash   TEXT,               -- SHA-256 of previous audit_log row for tamper evidence
  row_hash    TEXT,               -- SHA-256 of this row's content (computed on insert)
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE backups (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  destination  TEXT    NOT NULL,   -- file path or description
  file_name    TEXT    NOT NULL,
  file_size_kb INTEGER,
  checksum     TEXT    NOT NULL,   -- SHA-256 of the backup file
  trigger_type TEXT    NOT NULL CHECK (trigger_type IN ('scheduled', 'manual', 'pre_update')),
  status       TEXT    NOT NULL CHECK (status IN ('success', 'failed', 'in_progress')),
  error_msg    TEXT,
  started_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE settings (
  key        TEXT    NOT NULL PRIMARY KEY,
  value      TEXT    NOT NULL,
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

## 4. Key Relationships

```
users ──────< user_roles >────── roles ──────< role_permissions >────── permissions

items ──────< variants
items ──────< item_units >────── units
items ──────< prices

processing_rules ──────< processing_rule_outputs
processing_rules ──────< processing_transactions
customers ──────< processing_transactions (nullable)
bills ──────< processing_transactions (nullable)

customers ──────< bills
bills ──────< bill_lines
items ──────< bill_lines
variants ──────< bill_lines
bills ──────< payments
customers ──────< payments

suppliers ──────< stock_ins
items ──────< stock_ins
items ──────< inventory_transactions
items ──────< stock_adjustments

expense_categories ──────< expenses
users ──────< audit_log
```

---

## 5. How Stock Is Computed

Current stock for a given `(item_id, variant_id, stock_category)`:

```sql
SELECT
  item_id,
  variant_id,
  stock_category,
  SUM(qty_delta) AS current_stock
FROM inventory_transactions
WHERE item_id = ? AND variant_id = ? AND stock_category = ?
GROUP BY item_id, variant_id, stock_category;
```

For a full inventory snapshot across all items:

```sql
SELECT
  i.name        AS item_name,
  v.name        AS variant_name,
  t.stock_category,
  SUM(t.qty_delta) AS current_stock,
  u.symbol      AS unit
FROM inventory_transactions t
JOIN items    i ON i.id = t.item_id
JOIN variants v ON v.id = t.variant_id
JOIN items    ui ON ui.id = t.item_id
JOIN units    u  ON u.id = i.stocking_unit_id
GROUP BY t.item_id, t.variant_id, t.stock_category
ORDER BY i.name, v.name, t.stock_category;
```

**Performance note:** For datasets up to 500 k rows, this query with the composite index on `(item_id, variant_id, stock_category)` returns in < 50 ms. If needed, a materialized view can be maintained by triggers and refreshed on each write.

---

## 6. How Customer Balance Is Computed

```sql
SELECT
  c.id,
  c.name,
  COALESCE(SUM(b.grand_total) FILTER (WHERE b.status = 'active'), 0) AS total_billed,
  COALESCE(SUM(p.amount), 0)                                         AS total_paid,
  COALESCE(SUM(b.grand_total) FILTER (WHERE b.status = 'active'), 0)
    - COALESCE(SUM(p.amount), 0)                                     AS outstanding_balance
FROM customers c
LEFT JOIN bills    b ON b.customer_id = c.id
LEFT JOIN payments p ON p.customer_id = c.id
WHERE c.id = ?
GROUP BY c.id;
```

---

## 7. Bill Cancellation Flow (Data)

When a bill is cancelled:

```sql
-- 1. Update bill status
UPDATE bills
SET status = 'cancelled', cancelled_by = ?, cancelled_at = datetime('now'), cancel_reason = ?
WHERE id = ?;

-- 2. Insert compensating inventory transactions (positive delta = stock restored)
INSERT INTO inventory_transactions (item_id, variant_id, stock_category, tx_type, qty_delta, ref_type, ref_id, operator_id)
SELECT item_id, variant_id, 'finished', 'return', ABS(qty_in_base), 'bill', bill_id, ?
FROM bill_lines WHERE bill_id = ?;

-- 3. Write audit log entry
INSERT INTO audit_log (actor_id, action, entity, entity_id, before_json, reason)
VALUES (?, 'BILL_CANCELLED', 'bills', ?, ?, ?);
```

All three steps execute inside a single `db.transaction()` call.

---

## 8. Seed Data (Phase 1 Setup Wizard)

On first run, the setup wizard inserts:

```sql
-- Owner role with all permissions
INSERT INTO roles (name) VALUES ('Owner');
INSERT INTO users (username, password_hash, display_name) VALUES ('owner', <hash>, 'Mill Owner');

-- Default units
INSERT INTO units (name, symbol, to_base_factor) VALUES
  ('Kilogram', 'kg',  1),
  ('Gram',     'g',   0.001),
  ('Quintal',  'qtl', 100),
  ('Ton',      'ton', 1000),
  ('Piece',    'pcs', 1),
  ('Bora',     'bora', 50);  -- 1 Bora = 50 kg (confirm with owner)

-- Default expense categories
INSERT INTO expense_categories (name) VALUES
  ('Fuel'), ('Electricity'), ('Labor'), ('Maintenance'), ('Transport'), ('Other');

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('mill_name', 'Badachuli Rice Mill'),
  ('bill_prefix', 'BRM'),
  ('bill_next_number', '1'),
  ('fiscal_year_start_month', '4'),   -- Shrawan = Nepali month 4
  ('vat_enabled', '0'),
  ('vat_rate', '13'),
  ('printer_width', '80'),
  ('calendar_display', 'bs'),
  ('backup_auto_enabled', '1'),
  ('backup_retain_daily', '14'),
  ('backup_retain_weekly', '8');
```

-- ============================================================
-- Migration 0001: Initial schema — all Phase 1 entities
-- ============================================================

-- ── Auth ──────────────────────────────────────────────────
CREATE TABLE users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT    NOT NULL UNIQUE,
  pin_hash   TEXT    NOT NULL,
  role       TEXT    NOT NULL DEFAULT 'operator'
               CHECK (role IN ('owner', 'operator')),
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Catalog ───────────────────────────────────────────────
CREATE TABLE units (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL UNIQUE,
  abbreviation TEXT    NOT NULL UNIQUE,
  base_factor  REAL    NOT NULL DEFAULT 1.0
);

CREATE TABLE items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL UNIQUE,
  category      TEXT    NOT NULL
                  CHECK (category IN ('raw_material','finished','byproduct','consumable')),
  default_unit_id INTEGER NOT NULL REFERENCES units(id),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE variants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     INTEGER NOT NULL REFERENCES items(id),
  name        TEXT    NOT NULL,
  is_default  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  UNIQUE (item_id, name)
);

CREATE TABLE prices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     INTEGER NOT NULL REFERENCES items(id),
  variant_id  INTEGER          REFERENCES variants(id),
  unit_id     INTEGER NOT NULL REFERENCES units(id),
  price       NUMERIC NOT NULL,
  price_type  TEXT    NOT NULL DEFAULT 'sell'
                CHECK (price_type IN ('sell','buy')),
  effective_from TEXT NOT NULL DEFAULT (date('now')),
  effective_to   TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Processing ────────────────────────────────────────────
CREATE TABLE processing_rules (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  input_item_id  INTEGER NOT NULL REFERENCES items(id),
  reference_qty  NUMERIC NOT NULL,
  reference_unit_id INTEGER NOT NULL REFERENCES units(id),
  charge_per_unit NUMERIC NOT NULL DEFAULT 0,
  charge_unit_id  INTEGER          REFERENCES units(id),
  effective_from TEXT    NOT NULL DEFAULT (date('now')),
  effective_to   TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE processing_rule_outputs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id             INTEGER NOT NULL REFERENCES processing_rules(id),
  output_item_id      INTEGER NOT NULL REFERENCES items(id),
  output_variant_id   INTEGER          REFERENCES variants(id),
  qty_or_pct          NUMERIC NOT NULL,
  is_percentage       INTEGER NOT NULL DEFAULT 0,
  is_waste            INTEGER NOT NULL DEFAULT 0,
  is_byproduct        INTEGER NOT NULL DEFAULT 0,
  default_disposition TEXT    NOT NULL DEFAULT 'customer_takes'
                        CHECK (default_disposition IN (
                          'mill_keeps','customer_takes','operator_decides'
                        )),
  waives_charge_if_left INTEGER NOT NULL DEFAULT 0,
  sort_order          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE processing_transactions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  mode              TEXT    NOT NULL CHECK (mode IN ('in_house','customer')),
  rule_id           INTEGER NOT NULL REFERENCES processing_rules(id),
  input_item_id     INTEGER NOT NULL REFERENCES items(id),
  input_qty         NUMERIC NOT NULL,
  input_unit_id     INTEGER NOT NULL REFERENCES units(id),
  customer_id       INTEGER          REFERENCES customers(id),
  bill_id           INTEGER          REFERENCES bills(id),
  charge_waived     INTEGER NOT NULL DEFAULT 0,
  dispositions_json TEXT    NOT NULL DEFAULT '{}',
  notes             TEXT,
  operator_id       INTEGER NOT NULL REFERENCES users(id),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE processing_outputs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES processing_transactions(id),
  output_item_id INTEGER NOT NULL REFERENCES items(id),
  variant_id     INTEGER          REFERENCES variants(id),
  expected_qty   NUMERIC NOT NULL,
  actual_qty     NUMERIC NOT NULL,
  disposition    TEXT    NOT NULL
                   CHECK (disposition IN ('mill_keeps','customer_takes','waste'))
);

-- ── Customers ─────────────────────────────────────────────
CREATE TABLE customers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  phone       TEXT,
  address     TEXT,
  notes       TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Suppliers ─────────────────────────────────────────────
CREATE TABLE suppliers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  phone       TEXT,
  address     TEXT,
  notes       TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Billing ───────────────────────────────────────────────
CREATE TABLE bills (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number     TEXT    NOT NULL UNIQUE,
  bill_type       TEXT    NOT NULL CHECK (bill_type IN ('sale','processing')),
  status          TEXT    NOT NULL DEFAULT 'active'
                    CHECK (status IN ('draft','active','cancelled')),
  customer_id     INTEGER          REFERENCES customers(id),
  subtotal        NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  taxable_amount  NUMERIC NOT NULL DEFAULT 0,
  vat_amount      NUMERIC NOT NULL DEFAULT 0,
  grand_total     NUMERIC NOT NULL DEFAULT 0,
  paid_amount     NUMERIC NOT NULL DEFAULT 0,
  due_amount      NUMERIC NOT NULL DEFAULT 0,
  notes           TEXT,
  operator_id     INTEGER NOT NULL REFERENCES users(id),
  cancelled_by    INTEGER          REFERENCES users(id),
  cancelled_at    TEXT,
  cancel_reason   TEXT,
  is_reprinted    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE bill_lines (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id         INTEGER NOT NULL REFERENCES bills(id),
  item_id         INTEGER NOT NULL REFERENCES items(id),
  variant_id      INTEGER          REFERENCES variants(id),
  qty             NUMERIC NOT NULL,
  unit_id         INTEGER NOT NULL REFERENCES units(id),
  rate_snapshot   NUMERIC NOT NULL,
  line_discount   NUMERIC NOT NULL DEFAULT 0,
  line_total      NUMERIC NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

-- ── Payments ──────────────────────────────────────────────
CREATE TABLE payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id     INTEGER NOT NULL REFERENCES bills(id),
  customer_id INTEGER          REFERENCES customers(id),
  amount      NUMERIC NOT NULL,
  method      TEXT    NOT NULL
                CHECK (method IN ('cash','bank','digital','credit','byproduct_offset')),
  reference   TEXT,
  notes       TEXT,
  operator_id INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Inventory ─────────────────────────────────────────────
CREATE TABLE inventory_transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     INTEGER NOT NULL REFERENCES items(id),
  variant_id  INTEGER          REFERENCES variants(id),
  unit_id     INTEGER NOT NULL REFERENCES units(id),
  qty_delta   NUMERIC NOT NULL,
  category    TEXT    NOT NULL
                CHECK (category IN ('raw_material','in_process','finished','byproduct')),
  tx_type     TEXT    NOT NULL
                CHECK (tx_type IN (
                  'opening','stock_in','sale','processing_in','processing_out',
                  'adjustment','return','cancellation'
                )),
  reference_id   INTEGER,
  reference_type TEXT,
  notes          TEXT,
  operator_id    INTEGER NOT NULL REFERENCES users(id),
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Purchasing ────────────────────────────────────────────
CREATE TABLE purchase_orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id  INTEGER NOT NULL REFERENCES suppliers(id),
  status       TEXT    NOT NULL DEFAULT 'received'
                 CHECK (status IN ('pending','received','cancelled')),
  notes        TEXT,
  operator_id  INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE purchase_lines (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id        INTEGER NOT NULL REFERENCES purchase_orders(id),
  item_id         INTEGER NOT NULL REFERENCES items(id),
  variant_id      INTEGER          REFERENCES variants(id),
  qty             NUMERIC NOT NULL,
  unit_id         INTEGER NOT NULL REFERENCES units(id),
  rate            NUMERIC NOT NULL,
  line_total      NUMERIC NOT NULL
);

-- ── Expenses ──────────────────────────────────────────────
CREATE TABLE expense_categories (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT    NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE expenses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id   INTEGER NOT NULL REFERENCES expense_categories(id),
  amount        NUMERIC NOT NULL,
  description   TEXT,
  expense_date  TEXT    NOT NULL DEFAULT (date('now')),
  operator_id   INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── System ────────────────────────────────────────────────
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  action      TEXT    NOT NULL,
  entity_type TEXT    NOT NULL,
  entity_id   INTEGER,
  payload_json TEXT,
  operator_id INTEGER REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX idx_bills_customer        ON bills(customer_id);
CREATE INDEX idx_bills_created_at      ON bills(created_at);
CREATE INDEX idx_bills_status          ON bills(status);
CREATE INDEX idx_bill_lines_bill       ON bill_lines(bill_id);
CREATE INDEX idx_payments_bill         ON payments(bill_id);
CREATE INDEX idx_payments_customer     ON payments(customer_id);
CREATE INDEX idx_inv_item_variant      ON inventory_transactions(item_id, variant_id);
CREATE INDEX idx_inv_created_at        ON inventory_transactions(created_at);
CREATE INDEX idx_inv_category          ON inventory_transactions(category);
CREATE INDEX idx_processing_tx_rule    ON processing_transactions(rule_id);
CREATE INDEX idx_processing_tx_cust    ON processing_transactions(customer_id);
CREATE INDEX idx_prices_item_variant   ON prices(item_id, variant_id, effective_from);
CREATE INDEX idx_audit_entity          ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created_at      ON audit_log(created_at);

-- ── Seed Data ─────────────────────────────────────────────
INSERT INTO units (name, abbreviation, base_factor) VALUES
  ('Kilogram',  'kg',  1.0),
  ('Gram',      'g',   0.001),
  ('Quintal',   'qtl', 100.0),
  ('Ton',       'ton', 1000.0),
  ('Piece',     'pcs', 1.0),
  ('Bora',      'bora', 50.0),
  ('Litre',     'ltr',  1.0);

INSERT INTO expense_categories (name) VALUES
  ('Fuel'),
  ('Electricity'),
  ('Labour'),
  ('Maintenance'),
  ('Miscellaneous');

INSERT INTO settings (key, value) VALUES
  ('bill_prefix',        '"BRM"'),
  ('bill_next_sequence', '1'),
  ('vat_enabled',        'false'),
  ('vat_rate',           '13'),
  ('mill_name',          '"Badachuli Rice Mill"'),
  ('mill_address',       '"Kohalpur, Banke"'),
  ('mill_pan',           '""'),
  ('fiscal_year_start_month', '4');

-- No default user seeded here.
-- Owner account is created through the first-run setup wizard on first launch.

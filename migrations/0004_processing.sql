-- Processing rules: define how one input item becomes multiple outputs
CREATE TABLE IF NOT EXISTS processing_rules (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  input_item_id    INTEGER NOT NULL REFERENCES items(id),
  input_variant_id INTEGER          REFERENCES variants(id),
  input_unit_id    INTEGER NOT NULL REFERENCES units(id),
  is_active        INTEGER NOT NULL DEFAULT 1,
  notes            TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Each output line of a rule (e.g. 65% Chamal, 20% Dhuto, 10% Bhus)
CREATE TABLE IF NOT EXISTS processing_rule_outputs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id           INTEGER NOT NULL REFERENCES processing_rules(id),
  output_item_id    INTEGER NOT NULL REFERENCES items(id),
  output_variant_id INTEGER          REFERENCES variants(id),
  output_unit_id    INTEGER NOT NULL REFERENCES units(id),
  yield_pct         NUMERIC NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

-- A recorded processing run
CREATE TABLE IF NOT EXISTS processing_batches (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id          INTEGER NOT NULL REFERENCES processing_rules(id),
  input_item_id    INTEGER NOT NULL REFERENCES items(id),
  input_variant_id INTEGER          REFERENCES variants(id),
  input_unit_id    INTEGER NOT NULL REFERENCES units(id),
  input_qty        NUMERIC NOT NULL,
  batch_type       TEXT    NOT NULL DEFAULT 'in_house'
                   CHECK (batch_type IN ('in_house', 'customer')),
  customer_id      INTEGER          REFERENCES customers(id),
  notes            TEXT,
  operator_id      INTEGER NOT NULL REFERENCES users(id),
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Actual output quantities recorded for each batch
CREATE TABLE IF NOT EXISTS processing_batch_outputs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id          INTEGER NOT NULL REFERENCES processing_batches(id),
  output_item_id    INTEGER NOT NULL REFERENCES items(id),
  output_variant_id INTEGER          REFERENCES variants(id),
  output_unit_id    INTEGER NOT NULL REFERENCES units(id),
  expected_qty      NUMERIC NOT NULL,
  actual_qty        NUMERIC NOT NULL
);

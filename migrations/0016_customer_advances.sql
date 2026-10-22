CREATE TABLE customer_advances (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount      NUMERIC NOT NULL,
  note        TEXT,
  method      TEXT    NOT NULL CHECK (method IN ('cash','bank','digital')),
  operator_id INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_customer_advances_customer ON customer_advances(customer_id);

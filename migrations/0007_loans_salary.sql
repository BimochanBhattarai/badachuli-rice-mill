-- Money lent to a customer (debit in their ledger, raises outstanding)
CREATE TABLE customer_loans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount      NUMERIC NOT NULL,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  due_amount  NUMERIC NOT NULL,
  description TEXT,
  loan_date   TEXT    NOT NULL DEFAULT (date('now')),
  status      TEXT    NOT NULL DEFAULT 'active',
  operator_id INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Repayments collected against loans (credit lines)
CREATE TABLE customer_loan_payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id     INTEGER NOT NULL REFERENCES customer_loans(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount      NUMERIC NOT NULL,
  method      TEXT    NOT NULL CHECK (method IN ('cash','bank','digital')),
  operator_id INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE employees (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  phone      TEXT,
  position   TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE salary_payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  amount      NUMERIC NOT NULL,
  txn_type    TEXT    NOT NULL CHECK (txn_type IN ('salary','advance','bonus','deduction')),
  description TEXT,
  paid_date   TEXT    NOT NULL DEFAULT (date('now')),
  operator_id INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_customer_loans_customer ON customer_loans(customer_id);
CREATE INDEX idx_loan_payments_loan       ON customer_loan_payments(loan_id);
CREATE INDEX idx_salary_payments_employee ON salary_payments(employee_id);

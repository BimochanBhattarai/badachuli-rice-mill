CREATE TABLE employee_loans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  amount      NUMERIC NOT NULL,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  due_amount  NUMERIC NOT NULL,
  description TEXT,
  loan_date   TEXT    NOT NULL DEFAULT (date('now')),
  status      TEXT    NOT NULL DEFAULT 'active',
  operator_id INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Each repayment reduces the loan outstanding and also creates a salary deduction
CREATE TABLE employee_loan_payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id     INTEGER NOT NULL REFERENCES employee_loans(id),
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  amount      NUMERIC NOT NULL,
  paid_date   TEXT    NOT NULL DEFAULT (date('now')),
  operator_id INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_employee_loans_emp       ON employee_loans(employee_id);
CREATE INDEX idx_employee_loan_pay_loan   ON employee_loan_payments(loan_id);

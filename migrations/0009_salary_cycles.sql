ALTER TABLE employees ADD COLUMN base_salary NUMERIC NOT NULL DEFAULT 0;

CREATE TABLE salary_cycles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id  INTEGER NOT NULL REFERENCES employees(id),
  cycle_month  TEXT    NOT NULL,  -- YYYY-MM
  base_salary  NUMERIC NOT NULL,  -- snapshot at cycle open
  status       TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_at    TEXT,
  operator_id  INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, cycle_month)
);

ALTER TABLE salary_payments ADD COLUMN cycle_id INTEGER REFERENCES salary_cycles(id);

CREATE INDEX idx_salary_cycles_emp ON salary_cycles(employee_id);

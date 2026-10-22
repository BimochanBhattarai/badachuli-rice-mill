-- 0017: Balance-forward customer accounting.
--
-- Replaces per-bill payment allocation with ONE running balance per customer.
-- A payment is a single signed ledger row; it is never allocated across bills.
--
-- Sign convention: amount > 0 = customer owes (Dr.), amount < 0 = customer in credit (Cr.).
-- Ordering rule: balance accumulates strictly in `id` order. `created_at` is UTC with
-- second granularity and no tiebreaker, so it is NOT safe to order by (live data contains
-- same-second collisions). `entry_date` is display metadata only.

CREATE TABLE customer_ledger (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id   INTEGER NOT NULL REFERENCES customers(id),
  kind          TEXT    NOT NULL CHECK (kind IN (
                  'opening','sale','payment','loan','loan_repayment','cancel_reversal','adjustment')),
  amount        NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL DEFAULT 0,
  bill_id       INTEGER REFERENCES bills(id),
  loan_id       INTEGER REFERENCES customer_loans(id),
  business_id   INTEGER,                                  -- display metadata ONLY, never summed
  method        TEXT,
  note          TEXT,
  operator_id   INTEGER REFERENCES users(id),
  reversed_of   INTEGER REFERENCES customer_ledger(id),
  entry_date    TEXT    NOT NULL DEFAULT (date('now')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_customer_ledger_cust ON customer_ledger(customer_id, id);
CREATE INDEX idx_customer_ledger_bill ON customer_ledger(bill_id);

-- The one central balance column.
ALTER TABLE customers ADD COLUMN balance NUMERIC NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Backfill. Reconciles exactly to the old formula:
--   opening_balance + SUM(active bills.due_amount) + SUM(active loans.due_amount)
-- Cancelled bills and walk-in bills (NULL customer_id) are excluded, matching
-- every aggregate the app read before this migration.
-- ---------------------------------------------------------------------------
INSERT INTO customer_ledger
  (customer_id, kind, amount, bill_id, loan_id, business_id, method, note,
   operator_id, entry_date, created_at)
SELECT customer_id, kind, amount, bill_id, loan_id, business_id, method, note,
       operator_id, entry_date, created_at
FROM (
  -- True original opening balance. Advances had been *decrementing* opening_balance,
  -- so they are added back here and re-applied below as ordinary payment rows.
  SELECT c.id AS customer_id, 'opening' AS kind,
         ROUND(c.opening_balance
               + COALESCE((SELECT SUM(amount) FROM customer_advances
                            WHERE customer_id = c.id), 0), 2) AS amount,
         NULL AS bill_id, NULL AS loan_id, NULL AS business_id, NULL AS method,
         'Opening balance' AS note, NULL AS operator_id,
         DATE(c.created_at) AS entry_date, c.created_at AS created_at,
         0 AS grp, 0 AS kind_ord, c.id AS src_id
    FROM customers c
   WHERE ROUND(c.opening_balance
               + COALESCE((SELECT SUM(amount) FROM customer_advances
                            WHERE customer_id = c.id), 0), 2) <> 0

  UNION ALL
  SELECT b.customer_id, 'sale', ROUND(b.grand_total, 2),
         b.id, NULL, b.business_id, NULL, b.bill_number, b.operator_id,
         DATE(b.created_at), b.created_at, 1, 1, b.id
    FROM bills b
   WHERE b.status = 'active' AND b.customer_id IS NOT NULL

  UNION ALL
  -- INVARIANT P: bill_id is set on a payment row IF AND ONLY IF the cash was taken
  -- at the counter when that bill was created. Later debt collection carries
  -- bill_id = NULL even though the old `payments` table forced a bill_id on it
  -- (the FIFO allocator picked one). This is load-bearing: cancelBill reverses rows
  -- by bill_id, so a later payment left attached to a bill would be clawed back and
  -- the customer would silently lose credit they really paid.
  -- An at-creation payment is written in the same transaction as its bill and so
  -- shares its created_at exactly; that is the discriminator.
  SELECT p.customer_id, 'payment', ROUND(-p.amount, 2),
         CASE WHEN p.created_at = b.created_at THEN p.bill_id ELSE NULL END,
         NULL, b.business_id, p.method, p.notes, p.operator_id,
         DATE(p.created_at), p.created_at, 1, 2, p.id
    FROM payments p
    JOIN bills b ON b.id = p.bill_id
   WHERE b.status = 'active' AND p.customer_id IS NOT NULL

  UNION ALL
  SELECT l.customer_id, 'loan', ROUND(l.amount, 2),
         NULL, l.id, NULL, NULL, l.description, l.operator_id,
         l.loan_date, l.created_at, 1, 3, l.id
    FROM customer_loans l
   WHERE l.status = 'active'

  UNION ALL
  SELECT lp.customer_id, 'loan_repayment', ROUND(-lp.amount, 2),
         NULL, lp.loan_id, NULL, lp.method, NULL, lp.operator_id,
         DATE(lp.created_at), lp.created_at, 1, 4, lp.id
    FROM customer_loan_payments lp

  UNION ALL
  -- Advances are no longer a distinct concept: an overpayment is just a payment
  -- that leaves the balance negative.
  SELECT ca.customer_id, 'payment', ROUND(-ca.amount, 2),
         NULL, NULL, NULL, ca.method, ca.note, ca.operator_id,
         DATE(ca.created_at), ca.created_at, 1, 5, ca.id
    FROM customer_advances ca
)
ORDER BY customer_id, grp, created_at, kind_ord, src_id;

-- Running balance snapshot on every row, accumulated by id.
UPDATE customer_ledger
   SET balance_after = (
     WITH r AS (
       SELECT id,
              ROUND(SUM(amount) OVER (PARTITION BY customer_id
                                      ORDER BY id
                                      ROWS UNBOUNDED PRECEDING), 2) AS bal
         FROM customer_ledger
     )
     SELECT bal FROM r WHERE r.id = customer_ledger.id
   );

-- The central column = each customer's final balance_after.
UPDATE customers
   SET balance = COALESCE((
     SELECT cl.balance_after
       FROM customer_ledger cl
      WHERE cl.customer_id = customers.id
      ORDER BY cl.id DESC
      LIMIT 1
   ), 0);

-- ---------------------------------------------------------------------------
-- Reconciliation gate. Aborts the whole migration if any customer's new balance
-- disagrees with the pre-migration formula. Relational, so it holds for any DB
-- (dev, production import, or a fresh seed) rather than a hardcoded total.
-- ---------------------------------------------------------------------------
CREATE TABLE _assert_0017 (ok INTEGER NOT NULL CHECK (ok = 1));

INSERT INTO _assert_0017 (ok)
SELECT CASE WHEN (
  SELECT COUNT(*) FROM customers c
   WHERE ABS(
     ROUND(c.balance, 2) - ROUND(
       c.opening_balance
       + COALESCE((SELECT SUM(due_amount) FROM bills
                    WHERE customer_id = c.id AND status = 'active'), 0)
       + COALESCE((SELECT SUM(due_amount) FROM customer_loans
                    WHERE customer_id = c.id AND status = 'active'), 0), 2)
   ) > 0.005
) = 0 THEN 1 ELSE 0 END;

-- balance_after of the last row must equal the sum of all amounts, per customer.
INSERT INTO _assert_0017 (ok)
SELECT CASE WHEN (
  SELECT COUNT(*) FROM (
    SELECT customer_id,
           ROUND(SUM(amount), 2) AS total,
           ROUND((SELECT balance_after FROM customer_ledger x
                   WHERE x.customer_id = cl.customer_id
                   ORDER BY x.id DESC LIMIT 1), 2) AS last_after
      FROM customer_ledger cl
     GROUP BY customer_id
  ) WHERE ABS(total - last_after) > 0.005
) = 0 THEN 1 ELSE 0 END;

-- INVARIANT P: every payment row carrying a bill_id must share its bill's created_at.
INSERT INTO _assert_0017 (ok)
SELECT CASE WHEN (
  SELECT COUNT(*) FROM customer_ledger cl
    JOIN bills b ON b.id = cl.bill_id
   WHERE cl.kind = 'payment' AND cl.created_at <> b.created_at
) = 0 THEN 1 ELSE 0 END;

DROP TABLE _assert_0017;

-- ---------------------------------------------------------------------------
-- Rename bills.due_amount -> bills.credit_amount.
-- These two bill columns are now IMMUTABLE historical facts about one transaction
-- (cash taken at the counter, and the portion that went to credit). They are never
-- updated after insert and never summed into a balance. The rename exists so that
-- any aggregate still trying to SUM the old column fails loudly instead of silently
-- returning a wrong number.
-- ---------------------------------------------------------------------------
ALTER TABLE bills RENAME COLUMN due_amount TO credit_amount;

#!/usr/bin/env python3
"""
Verify the customer-ledger invariants. Read-only; exits non-zero on any failure.

    python3 scripts/verify-ledger.py [path/to/db]   (default: dev.db)

Run this after a migration, after a batch of billing, and as part of any backup
routine. `customers.balance` is denormalized for O(1) reads, so drift between it and
the ledger is the one failure mode that could go unnoticed -- these checks catch it.
"""
import sqlite3
import sys
from pathlib import Path

EPS = 0.005


def check(conn, name, sql, expect_zero_rows=True, params=()):
    rows = conn.execute(sql, params).fetchall()
    if expect_zero_rows:
        ok = len(rows) == 0
        detail = "" if ok else f" -> {len(rows)} offending row(s): {rows[:5]}"
    else:
        ok, detail = True, f" -> {rows}"
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}{detail}")
    return ok


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "dev.db")
    if not path.exists():
        print(f"ERROR: {path} not found", file=sys.stderr)
        return 2

    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    print(f"\n{path}  (schema version {version})\n")

    if version < 17:
        print("  SKIP: pre-0017 database, no customer_ledger to verify.\n")
        return 0

    results = []

    # A. customers.balance == SUM(ledger.amount)
    results.append(check(conn, "balance == SUM(ledger.amount)", f"""
        SELECT c.id, ROUND(c.balance,2), ROUND(COALESCE(SUM(cl.amount),0),2)
          FROM customers c
          LEFT JOIN customer_ledger cl ON cl.customer_id = c.id
         GROUP BY c.id
        HAVING ABS(ROUND(c.balance,2) - ROUND(COALESCE(SUM(cl.amount),0),2)) > {EPS}
    """))

    # B. customers.balance == last row's balance_after
    results.append(check(conn, "balance == last balance_after", f"""
        SELECT c.id, ROUND(c.balance,2), ROUND(COALESCE((
                 SELECT balance_after FROM customer_ledger x
                  WHERE x.customer_id = c.id ORDER BY x.id DESC LIMIT 1), 0), 2)
          FROM customers c
         WHERE ABS(ROUND(c.balance,2) - ROUND(COALESCE((
                 SELECT balance_after FROM customer_ledger x
                  WHERE x.customer_id = c.id ORDER BY x.id DESC LIMIT 1), 0), 2)) > {EPS}
    """))

    # C. per-row chain: balance_after == previous balance_after + amount
    results.append(check(conn, "balance_after chain is continuous", f"""
        WITH w AS (
          SELECT id, customer_id, amount, balance_after,
                 LAG(balance_after) OVER (PARTITION BY customer_id ORDER BY id) AS prev
            FROM customer_ledger
        )
        SELECT id, customer_id, amount, balance_after, prev FROM w
         WHERE ABS(balance_after - (COALESCE(prev,0) + amount)) > {EPS}
    """))

    # D. INVARIANT P: a payment carries a bill_id only if taken at that bill's creation.
    #    cancelBill reverses rows by bill_id, so a later payment attached to a bill
    #    would be clawed back and the customer would lose credit they really paid.
    results.append(check(conn, "Invariant P: bill-linked payments are at-creation only", """
        SELECT cl.id, cl.bill_id, cl.created_at, b.created_at
          FROM customer_ledger cl
          JOIN bills b ON b.id = cl.bill_id
         WHERE cl.kind = 'payment' AND cl.created_at <> b.created_at
    """))

    # E. no ledger row points at a bill belonging to a different customer
    results.append(check(conn, "no cross-customer bill references", """
        SELECT cl.id, cl.customer_id, b.customer_id
          FROM customer_ledger cl
          JOIN bills b ON b.id = cl.bill_id
         WHERE b.customer_id IS NOT NULL AND b.customer_id <> cl.customer_id
    """))

    # F. walk-in bills must never have produced a ledger row
    results.append(check(conn, "walk-in bills have no ledger rows", """
        SELECT cl.id FROM customer_ledger cl
          JOIN bills b ON b.id = cl.bill_id
         WHERE b.customer_id IS NULL
    """))

    # G. cancelled bills are fully reversed (sale + at-creation payment both undone)
    results.append(check(conn, "cancelled bills net to zero in the ledger", f"""
        SELECT b.id, ROUND(SUM(cl.amount),2)
          FROM bills b
          JOIN customer_ledger cl ON cl.bill_id = b.id
         WHERE b.status = 'cancelled' AND b.customer_id IS NOT NULL
         GROUP BY b.id
        HAVING ABS(SUM(cl.amount)) > {EPS}
    """))

    print()
    check(conn, "TOTALS", """
        SELECT ROUND(SUM(balance),2) AS net,
               ROUND(COALESCE(SUM(CASE WHEN balance > 0.005 THEN balance END),0),2) AS receivable,
               ROUND(-COALESCE(SUM(CASE WHEN balance < -0.005 THEN balance END),0),2) AS credit_held,
               SUM(balance < -0.005) AS customers_in_credit,
               (SELECT COUNT(*) FROM customer_ledger) AS ledger_rows
          FROM customers
    """, expect_zero_rows=False)

    conn.close()
    ok = all(results)
    print(f"\n{'ALL INVARIANTS PASS' if ok else 'INVARIANT FAILURES PRESENT'}\n")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

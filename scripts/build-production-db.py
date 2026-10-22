#!/usr/bin/env python3
"""
Build a production-ready badachuli.db by combining:
  - Catalog (units, items, variants, prices) from --catalog db
  - Businesses, users, settings from --source db
  - All customers with their final opening balance from Ricemills.mdb (MS Access)

Usage:
  python3 scripts/build-production-db.py \
    --catalog ~/Downloads/badachuli\ \(1\).db \
    --source dev.db \
    --access ~/Downloads/Ricemills.mdb \
    --output badachuli.db
"""

import argparse
import csv
import io
import os
import sqlite3
import subprocess
import sys
from collections import defaultdict

# Derived from the migrations directory rather than hardcoded, so this script can
# never silently fall behind the app again (it was pinned at version 6 while the app
# had reached 16). The emitted DB is fully migrated, so the Electron runner has
# nothing left to apply on first launch.
def _discover_migrations(base_dir: str) -> tuple[list[str], int]:
    mig_dir = os.path.join(base_dir, "migrations")
    files = sorted(f for f in os.listdir(mig_dir) if f.endswith(".sql"))
    if not files:
        raise RuntimeError(f"no migrations found in {mig_dir}")
    latest = int(files[-1].split("_")[0])
    return [os.path.join("migrations", f) for f in files], latest


def read_access_table(mdb_path: str, table: str) -> list[dict]:
    result = subprocess.run(
        ["mdb-export", mdb_path, table],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"mdb-export failed for {table}: {result.stderr}")
    reader = csv.DictReader(io.StringIO(result.stdout))
    return list(reader)


# Migration 0017 backfills the customer ledger FROM customers.opening_balance, so it
# must run after the Access import. Anything at or below this version is pure schema
# and must run before it.
SCHEMA_CUTOFF_VERSION = 16


def run_migrations(
    conn: sqlite3.Connection, base_dir: str, lo: int = 0, hi: int | None = None
) -> int:
    """Apply migrations with version in (lo, hi]. Returns the version reached."""
    migrations, latest = _discover_migrations(base_dir)
    hi = latest if hi is None else hi
    applied = conn.execute("PRAGMA user_version").fetchone()[0]

    for rel_path in migrations:
        version = int(os.path.basename(rel_path).split("_")[0])
        if not (lo < version <= hi):
            continue
        full_path = os.path.join(base_dir, rel_path)
        with open(full_path, "r", encoding="utf-8") as f:
            sql = f.read()
        conn.executescript(sql)
        applied = version

    conn.execute(f"PRAGMA user_version = {applied}")
    conn.commit()
    return applied


def copy_table(src: sqlite3.Connection, dst: sqlite3.Connection, table: str) -> int:
    rows = src.execute(f"SELECT * FROM {table}").fetchall()
    if not rows:
        return 0
    cols = [d[0] for d in src.execute(f"SELECT * FROM {table} LIMIT 0").description]
    placeholders = ", ".join(["?"] * len(cols))
    col_names = ", ".join(cols)
    dst.executemany(
        f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})",
        rows,
    )
    return len(rows)


def copy_catalog(catalog: sqlite3.Connection, system: sqlite3.Connection, dst: sqlite3.Connection) -> None:
    # Catalog items and users come from the provided catalog db
    for table in ["units", "items", "variants", "prices", "users"]:
        copy_table(catalog, dst, table)

    # Businesses come from the system/dev db (catalog db has none)
    copy_table(system, dst, "businesses")

    # Reset bill sequences to 1 for a clean start
    dst.execute("UPDATE businesses SET bill_next_sequence = 1")

    # Copy only the ui_language setting from system db
    row = system.execute(
        "SELECT key, value FROM settings WHERE key = 'ui_language'"
    ).fetchone()
    if row:
        dst.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            row,
        )

    dst.commit()


def import_customers(
    mdb_path: str, dst: sqlite3.Connection
) -> tuple[int, int, float]:
    customers_raw = read_access_table(mdb_path, "tblcustomer")
    ledger_raw = read_access_table(mdb_path, "tblledger")

    # Build balance map: customer_id -> {debit, credit, name}
    balance: dict[str, dict] = defaultdict(
        lambda: {"debit": 0.0, "credit": 0.0, "name": ""}
    )
    for row in ledger_raw:
        cid = row["CUSTOMERID"].strip()
        balance[cid]["debit"] += float(row["DEBIT"] or 0)
        balance[cid]["credit"] += float(row["CREDIT"] or 0)
        name = (row.get("NAME OF CUSTOMER") or "").strip()
        if name:
            balance[cid]["name"] = name

    # Build customer map from tblcustomer: id -> info
    cust_map: dict[str, dict] = {}
    for row in customers_raw:
        cid = row["ID"].strip()
        addr_parts = [
            p for p in [
                (row.get("ADDRESS") or "").strip(),
                (row.get("TOLE") or "").strip(),
            ]
            if p
        ]
        cust_map[cid] = {
            "name": (row.get("CUSTOMERNAME") or "").strip(),
            "address": ", ".join(addr_parts) or None,
            "phone": (row.get("PHONENO") or "").strip() or None,
        }

    # Merge: customers in ledger but not in tblcustomer get added too
    all_ids = sorted(
        set(cust_map.keys()) | set(balance.keys()),
        key=lambda x: int(x) if x.isdigit() else 0,
    )

    inserted = 0
    non_zero = 0
    grand_total = 0.0

    for cid in all_ids:
        if cid not in cust_map and cid not in balance:
            continue

        info = cust_map.get(cid, {})
        bal = balance.get(cid, {"debit": 0.0, "credit": 0.0, "name": ""})

        name = info.get("name") or bal["name"]
        if not name:
            continue

        opening = round(bal["debit"] - bal["credit"], 2)

        dst.execute(
            """INSERT INTO customers (name, address, phone, opening_balance)
               VALUES (?, ?, ?, ?)""",
            (name, info.get("address"), info.get("phone"), opening),
        )
        inserted += 1
        if opening != 0.0:
            non_zero += 1
            grand_total += opening

    dst.commit()
    return inserted, non_zero, grand_total


def main() -> None:
    parser = argparse.ArgumentParser(description="Build production badachuli.db")
    parser.add_argument(
        "--catalog",
        default=os.path.expanduser("~/Downloads/badachuli (1).db"),
        help="Path to db with items/units/variants/prices",
    )
    parser.add_argument("--source", default="dev.db", help="Path to dev.db (businesses, users, settings)")
    parser.add_argument(
        "--access",
        default=os.path.expanduser("~/Downloads/Ricemills.mdb"),
        help="Path to Ricemills.mdb",
    )
    parser.add_argument("--output", default="badachuli.db", help="Output db path")
    args = parser.parse_args()

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    for path, label in [
        (args.catalog, "catalog db"),
        (args.source, "system db"),
        (args.access, "Access file"),
    ]:
        if not os.path.exists(path):
            print(f"ERROR: {label} not found: {path}", file=sys.stderr)
            sys.exit(1)

    if os.path.exists(args.output):
        os.remove(args.output)
        print(f"Removed existing {args.output}")

    print(f"Creating {args.output} ...")
    dst = sqlite3.connect(args.output)
    dst.execute("PRAGMA foreign_keys = OFF")
    dst.execute("PRAGMA journal_mode = WAL")

    print(f"Running schema migrations (up to {SCHEMA_CUTOFF_VERSION}) ...")
    run_migrations(dst, base_dir, hi=SCHEMA_CUTOFF_VERSION)

    print(f"Copying catalog from {args.catalog} ...")
    print(f"Copying businesses/users from {args.source} ...")
    catalog = sqlite3.connect(args.catalog)
    system = sqlite3.connect(args.source)
    copy_catalog(catalog, system, dst)
    catalog.close()
    system.close()

    units = dst.execute("SELECT COUNT(*) FROM units").fetchone()[0]
    items = dst.execute("SELECT COUNT(*) FROM items").fetchone()[0]
    variants = dst.execute("SELECT COUNT(*) FROM variants").fetchone()[0]
    prices = dst.execute("SELECT COUNT(*) FROM prices").fetchone()[0]
    users = dst.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    print(f"  units={units}  items={items}  variants={variants}  prices={prices}  users={users}")

    print(f"Importing customers from {args.access} ...")
    inserted, non_zero, grand_total = import_customers(args.access, dst)

    # Now that opening balances exist, run the data migrations that derive from them
    # (0017 builds the customer ledger and sets customers.balance).
    print(f"Running data migrations (above {SCHEMA_CUTOFF_VERSION}) ...")
    run_migrations(dst, base_dir, lo=SCHEMA_CUTOFF_VERSION)

    ledger_rows = dst.execute("SELECT COUNT(*) FROM customer_ledger").fetchone()[0]
    ledger_total = dst.execute(
        "SELECT COALESCE(SUM(balance),0) FROM customers"
    ).fetchone()[0]
    print(f"  ledger rows={ledger_rows}  sum(customers.balance)=Rs. {ledger_total:,.2f}")

    version = dst.execute("PRAGMA user_version").fetchone()[0]
    dst.close()

    print()
    print("=" * 50)
    print(f"Output:         {args.output}")
    print(f"Schema version: {version}")
    print(f"Customers:      {inserted} inserted")
    print(f"  Non-zero bal: {non_zero}")
    print(f"  Grand total outstanding: Rs. {grand_total:,.2f}")
    print("=" * 50)
    print()
    print("Copy this file to %APPDATA%\\Badachuli Rice Mill\\badachuli.db on Windows.")


if __name__ == "__main__":
    main()

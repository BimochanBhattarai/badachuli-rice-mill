# Badachuli Rice Mill — Billing & Inventory Management System
## Documentation Index

This folder contains the complete engineering documentation for the Badachuli Rice Mill desktop application. All design decisions, data models, module specifications, user flows, and the implementation roadmap live here. Read this before writing a single line of code.

---

## Reading Order for New Team Members

1. **[System Overview](01_SYSTEM_OVERVIEW.md)** — What we're building and why
2. **[Architecture](02_ARCHITECTURE.md)** — Tech stack and system design decisions
3. **[Data Model](03_DATA_MODEL.md)** — The database: every entity, column, and relationship
4. **[User Flows](05_USER_FLOWS.md)** — How the operator actually uses the system day-to-day
5. **Module docs** (pick the ones relevant to your sprint)
6. **[Compliance](06_COMPLIANCE.md)** — Nepal-specific requirements (BS calendar, IRD)
7. **[Roadmap](07_ROADMAP.md)** — Sprint plan and phase breakdown

---

## Document Index

| File | Description |
|---|---|
| [01_SYSTEM_OVERVIEW.md](01_SYSTEM_OVERVIEW.md) | Business context, objectives, scope, glossary, assumptions |
| [02_ARCHITECTURE.md](02_ARCHITECTURE.md) | Electron + React + SQLite stack, layered architecture, IPC pattern, folder structure |
| [03_DATA_MODEL.md](03_DATA_MODEL.md) | All 24 entities with full DDL, relationships, and data integrity rules |
| [04_MODULES/BILLING.md](04_MODULES/BILLING.md) | Bill creation, payment, reprint, fast-path keyboard flow |
| [04_MODULES/INVENTORY.md](04_MODULES/INVENTORY.md) | Stock ledger, stock-in, negative-stock guard, adjustments |
| [04_MODULES/PROCESSING.md](04_MODULES/PROCESSING.md) | Processing rules engine — in-house and customer processing |
| [04_MODULES/PRINTING.md](04_MODULES/PRINTING.md) | 80mm ESC/POS thermal bill printing |
| [04_MODULES/REPORTING.md](04_MODULES/REPORTING.md) | All report types, filters, export formats |
| [04_MODULES/BACKUP.md](04_MODULES/BACKUP.md) | Automatic/manual backup, validated restore, retention policy |
| [04_MODULES/CUSTOMERS.md](04_MODULES/CUSTOMERS.md) | Customer profiles, udharo/credit tracking, payment collection |
| [04_MODULES/SUPPLIERS.md](04_MODULES/SUPPLIERS.md) | Supplier profiles, raw material purchase tracking |
| [04_MODULES/EXPENSES.md](04_MODULES/EXPENSES.md) | Expense logging and P&L integration |
| [05_USER_FLOWS.md](05_USER_FLOWS.md) | Step-by-step journeys for every major operation |
| [06_COMPLIANCE.md](06_COMPLIANCE.md) | BS calendar, IRD bill format, VAT toggle, Nepal fiscal year |
| [07_ROADMAP.md](07_ROADMAP.md) | Sprint 0–8 plan, Phase 2–5 roadmap, risk register |
| [08_DB_ARCHITECTURE.md](08_DB_ARCHITECTURE.md) | ERDs by cluster, cross-cluster FK map, write sequences for every operation, read patterns, index strategy, migration system |

---

## Key Decisions at a Glance

| Decision | Choice | Why |
|---|---|---|
| Desktop shell | Electron | Familiar JS ecosystem; acceptable on dedicated billing PC |
| UI | React + TypeScript | Mature, keyboard-navigable components |
| Database | SQLite (WAL mode) | Zero-admin, offline, single-file, proven |
| DB driver | better-sqlite3 (sync) | Simpler, faster for single-user desktop than async drivers |
| ORM | Drizzle ORM | Lightweight, type-safe, no magic |
| Architecture | Ledger-centric | Stock and totals always computed from transactions, never stored separately |
| Printer | 80mm ESC/POS | Standard business thermal printer; raw ESC/POS bytes, vendor-agnostic |
| Calendar | BS + AD | Store AD internally, display BS on all customer-facing outputs |
| VAT | Togglable | Confirm with accountant; design supports both VAT and non-VAT billing |

---

## Confirmed Domain Knowledge

- **Primary business:** Customer processing service (walk-in customers bring own grain)
- **Items processed:** Dhan, Tori, Makai, Gahu, Kodo — one item per batch (no blending)
- **Mill also sells:** Chamal, Makai products, Tori ko Tel, Dhuto, others
- **Byproduct-as-payment system:** Leaving Dhuto (from Dhan) or Pina (from Tori) = NRs 0 charge. All other items always pay. **A bill is always generated for every customer processing transaction** regardless of charge amount — it is both a financial record and the work-order token the customer hands to the mill operator.
- **Mill is PAN-registered** with Nepal IRD
- **Single-input rules only** — no multi-input blending needed
- All ratios are variable and owner-configurable — nothing is hard-coded

## Still Open (Low Priority — Can Be Confirmed During Setup Wizard)

1. Exact processing ratios as starting defaults (owner enters/adjusts through UI)
2. Typical daily transaction volume (for performance baseline)
3. Any existing ledger data to migrate?
4. UI theme preference — light or dark?

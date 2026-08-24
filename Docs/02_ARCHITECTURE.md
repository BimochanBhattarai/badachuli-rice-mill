# 02 — System Architecture

## 1. Development vs. Deployment Platform

| | Platform |
|---|---|
| **Development** | macOS (developer machines) |
| **Deployment target** | Windows 10/11 (mill PC) |

`electron-builder` produces Windows `.exe` installers from a macOS build machine via a GitHub Actions `windows-latest` CI runner. Developers run and test on macOS; Windows installer builds and E2E tests run on the CI runner. See `07_ROADMAP.md` Section 1 for the full CI setup.

**Cross-platform rules:**
- Always use `path.join()` — never hardcode `/` or `\` path separators.
- Use `app.getPath('userData')` for the DB and backup paths — this resolves to `%APPDATA%\badachuli` on Windows and `~/Library/Application Support/badachuli` on macOS.
- Test printer port access on an actual Windows machine (or the CI runner) before Sprint 5 demo.

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Desktop shell | **Electron** | Familiar Node.js/TypeScript environment; acceptable on a dedicated 4 GB billing PC with the optimizations listed below |
| UI framework | **React + TypeScript** | Mature ecosystem, keyboard-navigable component libraries, strong type safety |
| Local database | **SQLite** (WAL mode) | Zero-admin, transactional, single-file, proven for offline-first desktop apps |
| DB driver | **better-sqlite3** | Synchronous API — simpler code, faster for a single-user app than async `node-sqlite3` |
| ORM / Query layer | **Drizzle ORM** | Lightweight, type-safe SQL generation, no heavyweight runtime, pairs perfectly with better-sqlite3 |
| IPC bridge | **Electron IPC** (`ipcMain` / `ipcRenderer`) with `contextBridge` | Secure, structured communication between UI and main process |
| Thermal printing | **escpos-js** or **node-thermal-printer** | Generates raw ESC/POS byte streams — vendor-agnostic, no printer SDK lock-in |
| App settings | **electron-store** | Simple, typed key-value store for non-transactional settings (printer selection, theme, etc.) |
| Packaging | **electron-builder** | Cross-platform installer generation, auto-update support |
| BS calendar | **bikram-sambat** (npm) | Well-maintained AD ↔ BS conversion library |
| Reporting export | **exceljs** (XLSX) + **@react-pdf/renderer** (PDF) | Widely used, no native dependencies |
| Testing | **Vitest** (unit) + **Playwright** (E2E) | Fast unit test runner; Playwright has first-class Electron support |

---

## 2. Electron on 4 GB RAM — Viability

Electron's base overhead on Windows is approximately 150–200 MB (main process + renderer combined) on a freshly loaded screen. On a 4 GB machine running only this application plus Windows, this is acceptable.

**Mandatory optimizations to keep memory in check:**

```
1. app.disableHardwareAcceleration()
   → Called before app.whenReady(). Saves ~30–50 MB on machines with integrated graphics.

2. contextIsolation: true, nodeIntegration: false
   → Security best practice; also prevents accidental Node.js usage in the renderer.

3. Lazy-load heavy modules
   → Reporting, backup, and print modules are loaded only when the user navigates to them.
   → Use dynamic import() in the renderer, and register IPC handlers on-demand in main.

4. Single BrowserWindow
   → Never create multiple windows for the same session; use React routing instead.

5. Avoid preloading all data on startup
   → Dashboard fetches only summary stats (5 SQL aggregates), not full tables.
```

Expected steady-state memory usage: **~170–200 MB total** on a billing session with typical data volumes (< 500 k rows). This leaves 3.8 GB for Windows and other processes — workable for a dedicated billing PC.

---

## 3. Layered Architecture

The application is organized into five strict layers. The cardinal rule is **no layer may skip a layer** — the renderer never touches the database, and the domain never touches the UI.

```
┌─────────────────────────────────────────────────────────┐
│              PRESENTATION LAYER (Renderer Process)       │
│  React components, UI state, forms, keyboard shortcuts   │
│  No business logic. Only calls IPC and renders results.  │
└──────────────────────────┬──────────────────────────────┘
                           │ ipcRenderer.invoke()
                           ↓
┌─────────────────────────────────────────────────────────┐
│            SERVICE / IPC LAYER (Main Process)            │
│  Use-case handlers: createBill, runProcessing,           │
│  adjustStock, restoreBackup, …                           │
│  Orchestrates domain + repositories in one DB            │
│  transaction. Enforces authorization checks.             │
└──────────┬───────────────────────────┬──────────────────┘
           ↓                           ↓
┌──────────────────────┐   ┌──────────────────────────────┐
│    DOMAIN LAYER      │   │      REPOSITORY LAYER        │
│  Pure functions:     │   │  Drizzle ORM queries.        │
│  - Pricing resolve   │   │  One repository per          │
│  - Unit conversion   │   │  aggregate:                  │
│  - Processing yield  │   │  - BillRepository            │
│  - Inventory math    │   │  - InventoryRepository       │
│  - VAT calculation   │   │  - CustomerRepository        │
│  - Audit hash chain  │   │  - ProcessingRepository      │
│  Zero I/O. Fully     │   │  - SupplierRepository        │
│  unit-testable.      │   │  - ExpenseRepository         │
└──────────────────────┘   └──────────────┬───────────────┘
                                          ↓
┌─────────────────────────────────────────────────────────┐
│              INFRASTRUCTURE LAYER                        │
│  - SQLite file access (better-sqlite3)                   │
│  - Printer adapter (ESC/POS byte generation)             │
│  - Backup adapters (filesystem, USB, cloud folder)       │
│  - Audit log writer                                      │
│  - OS filesystem (file dialogs, path resolution)         │
└─────────────────────────────────────────────────────────┘
```

---

## 4. IPC Communication Pattern

Every user action that requires business logic follows this pattern:

```
Renderer (React)                    Main Process
─────────────────                   ──────────────────────────
User clicks "Save Bill"
  ↓
ipcRenderer.invoke('bill:create', payload)
                              ─────→  ipcMain.handle('bill:create', handler)
                                         ↓
                                      authCheck(actor, 'CREATE_BILL')
                                         ↓
                                      db.transaction(() => {
                                        domain.validateBill(payload)
                                        domain.resolvePrices(lines)
                                        billRepo.insert(bill)
                                        billLineRepo.insertMany(lines)
                                        inventoryRepo.deductStock(lines)
                                        auditLog.write(actor, 'BILL_CREATED', ...)
                                      })
                                         ↓
                              ←─────  return { ok: true, billId, billNo }
  ↓
Show success toast
Trigger print flow
```

**Rules:**
- All handlers are `async` and return `{ ok: true, data }` or `{ ok: false, error }`.
- The renderer never interprets a database error directly — the service layer normalizes errors.
- No database handle is ever passed to the renderer via `contextBridge`.

---

## 5. Database Transaction Integrity

Every multi-step write executes inside a single SQLite transaction using better-sqlite3's `db.transaction()`:

```typescript
const createBill = db.transaction((payload: CreateBillPayload) => {
  const bill    = billRepo.insert(payload.header);
  const lines   = billLineRepo.insertMany(bill.id, payload.lines);
  const txns    = inventoryRepo.deductForBill(bill.id, lines);
  const payment = paymentRepo.insert(bill.id, payload.payment);
  auditLog.write(payload.actorId, 'BILL_CREATED', { billId: bill.id });
  return bill;
});
```

If any step throws, SQLite automatically rolls back the entire transaction. There is no partial state: a bill either exists with all its matching inventory movements, or it doesn't exist at all.

---

## 6. Key Architectural Decisions

### 6.1 Ledger-Centric Data Model

**Decision:** Stock levels and financial totals are never stored as editable running numbers. They are always computed as `SUM(qty_delta)` or `SUM(amount)` over the `inventory_transactions` and `payments` tables.

**Why:** A running total that can be edited independently of the transactions that produced it will eventually drift. A ledger can never drift — the history is the truth.

**Performance:** For 5 years of data (~500 k rows), indexed aggregates return in < 50 ms. A materialized view refreshed on each write provides sub-millisecond reads at scale if needed (see `03_DATA_MODEL.md`).

### 6.2 No Hard Deletes

**Decision:** Completed transactions are never physically deleted. Cancellations and returns are modeled as status changes plus compensating ledger entries.

**Why:** Enables full audit trail, correct report totals regardless of what happens to bills after the fact, and simplifies fiscal-year reconciliation.

### 6.3 Price Snapshotting

**Decision:** Every bill line records `rate_snapshot` — the price in effect at the moment the bill was saved. Reports and reprints always use this snapshot, never the current price list.

**Why:** Reprinting a 6-month-old bill must show the price the customer actually paid, even if the item has since been repriced ten times.

### 6.4 Explicit Processing Mode

**Decision:** The processing mode (In-House vs. Customer) is an explicit field set by the operator at the start of the operation — never inferred from whether a bill was created.

**Why:** Inferring mode from downstream state creates subtle bugs during edge cases (e.g., a customer processing batch where the bill is later cancelled). Explicit mode = unambiguous intent.

### 6.5 Default Variant for Variant-Less Items

**Decision:** Items without variants still get a system-generated `default` variant record internally. All billing and inventory logic works against `(item_id, variant_id)` pairs with no branching on "has variants vs. not."

**Why:** Eliminates a class of null-handling bugs throughout the codebase. The variant abstraction is uniform end-to-end.

---

## 7. Project Folder Structure (App Code)

```
badachuli-app/
├── electron/
│   ├── main.ts                  # Electron main process entry
│   ├── preload.ts               # contextBridge API exposed to renderer
│   ├── ipc/                     # IPC handler registration
│   │   ├── bill.handlers.ts
│   │   ├── inventory.handlers.ts
│   │   ├── processing.handlers.ts
│   │   ├── customer.handlers.ts
│   │   ├── supplier.handlers.ts
│   │   ├── expense.handlers.ts
│   │   ├── backup.handlers.ts
│   │   └── report.handlers.ts
│   ├── services/                # Use-case orchestration (service layer)
│   │   ├── bill.service.ts
│   │   ├── inventory.service.ts
│   │   ├── processing.service.ts
│   │   └── backup.service.ts
│   ├── domain/                  # Pure business logic (no I/O)
│   │   ├── pricing.ts
│   │   ├── processing-engine.ts
│   │   ├── inventory.ts
│   │   ├── vat.ts
│   │   ├── unit-conversion.ts
│   │   └── audit-hash.ts
│   ├── repositories/            # Drizzle ORM queries
│   │   ├── bill.repo.ts
│   │   ├── inventory.repo.ts
│   │   ├── customer.repo.ts
│   │   ├── supplier.repo.ts
│   │   ├── processing.repo.ts
│   │   └── expense.repo.ts
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema definitions
│   │   ├── migrations/          # SQL migration files
│   │   └── index.ts             # DB connection + WAL setup
│   └── infrastructure/
│       ├── printer.ts           # ESC/POS adapter
│       ├── backup.ts            # Backup + restore logic
│       └── audit-log.ts         # Append-only audit writer
│
├── src/                         # React renderer
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Router setup
│   ├── pages/
│   │   ├── Dashboard/
│   │   ├── Billing/
│   │   ├── Inventory/
│   │   ├── Processing/
│   │   ├── Customers/
│   │   ├── Suppliers/
│   │   ├── Expenses/
│   │   ├── Reports/
│   │   ├── Backup/
│   │   └── Settings/
│   ├── components/              # Shared UI components
│   ├── hooks/                   # Custom React hooks (useIPC, useInventory, etc.)
│   ├── store/                   # Zustand or Context for local UI state
│   └── utils/
│       ├── bs-calendar.ts       # BS ↔ AD conversion wrappers
│       ├── currency.ts          # NRs formatting
│       └── validation.ts        # Zod schemas for form validation
│
├── Docs/                        # This documentation folder
├── package.json
├── tsconfig.json
├── electron-builder.config.ts
└── vite.config.ts               # Renderer bundler (Vite + Electron plugin)
```

---

## 8. Non-Functional Requirements

| ID | Category | Requirement | Target |
|---|---|---|---|
| NFR-01 | Performance | Bill save + print-trigger latency | < 300 ms |
| NFR-02 | Performance | Cold app startup | < 4 seconds on 4 GB PC |
| NFR-03 | Performance | Report generation (1 year data) | < 2 seconds |
| NFR-04 | Resource | Idle memory footprint | < 220 MB |
| NFR-05 | Reliability | Data durability across power loss | Zero committed-transaction loss (WAL + fsync) |
| NFR-06 | Reliability | Crash recovery | Clean restart; no orphaned half-written bills |
| NFR-07 | Availability | Offline operation | 100% of core flows work with zero network |
| NFR-08 | Security | Password storage | Argon2id hashed, never plaintext |
| NFR-09 | Usability | Core billing flow | Keyboard-only, ≤ 5 interactions for 1-line cash sale |
| NFR-10 | Portability | OS | Windows 10/11 primary; Linux desktop secondary |
| NFR-11 | Maintainability | Test coverage | ≥ 80% on domain layer |
| NFR-12 | Scalability | Data volume | 5+ years / ~500 k rows with no perceptible slowdown |
| NFR-13 | Compliance | Bill format | Meets Nepal IRD minimum invoice content |
| NFR-14 | Localization | Calendar | BS dates on all customer-facing outputs |

---

## 9. Security Architecture

| Concern | Implementation |
|---|---|
| Authentication | Argon2id-hashed PIN/password; configurable lockout after failed attempts |
| Authorization | Every service-layer handler checks `auth.can(actor, permission)` before executing |
| Input validation | Zod schemas on renderer input; domain functions re-validate before DB write |
| IPC security | `contextIsolation: true`, `nodeIntegration: false`, whitelist of exposed IPC channels via preload |
| Data at rest | Optional SQLCipher encryption of the local DB file (Settings toggle) |
| Audit trail | Append-only `audit_log` table; hash-chained rows for tamper evidence |
| App updates | electron-builder auto-update with code-signing verification |
| Backup security | Encrypted backups if DB encryption is enabled |

---

## 10. Phase Evolution Path

The architecture is designed so each phase adds to — not restructures — what came before:

| Phase | What Changes |
|---|---|
| Phase 2 — RBAC | Insert rows into `roles` / `permissions` tables; build the Manage Users screen; the auth service already routes through the permission table from Phase 1 |
| Phase 3 — Multi-terminal | Swap the Repository Layer's SQLite driver for a networked one (e.g., LibSQL / Turso); the Domain and Service layers are untouched |
| Phase 4 — Cloud sync | Add a sync adapter in the Infrastructure Layer; the ledger's monotonic `created_at` timestamps make conflict resolution tractable |
| Phase 5 — Analytics | Add read-only materialized views and a reporting dashboard that queries the same ledger; no schema changes to the write path |

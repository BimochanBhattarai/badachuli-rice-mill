# 07 — Implementation Roadmap

## 1. Development Environment

| Item | Detail |
|---|---|
| Development OS | macOS (developer machines) |
| Target OS | Windows 10/11 (mill deployment) |
| Cross-compilation | `electron-builder` on macOS can produce Windows `.exe` installers via Wine or a Windows CI runner (GitHub Actions with `windows-latest` runner is simplest) |
| Installer format | NSIS installer (`.exe`) — most familiar to Windows users |
| Auto-update | `electron-updater` with a signed release channel |
| Node.js | LTS (v20+) |
| Package manager | pnpm (faster, less disk usage than npm for Electron projects) |

**Recommended CI approach for Windows builds:** Use GitHub Actions with a `windows-latest` runner for all Windows installer builds. Develop and run unit/domain tests on macOS; E2E tests run on the Windows CI runner against the packaged app.

---

## 2. Phase 1 Sprint Plan

2-week sprints. Each sprint assumes one developer working full-time. Adjust timelines for team size.

### Sprint 0 — Foundations (2 weeks)

**Goal:** Working skeleton that can run on macOS (dev) and be built for Windows.

| Deliverable | Notes |
|---|---|
| Electron + React + TypeScript scaffold | Use `electron-vite` template |
| SQLite integration (better-sqlite3 + Drizzle) | WAL mode enabled; schema migrations wired |
| Database schema (all 26 tables) | Per `03_DATA_MODEL.md` |
| Seed data & setup wizard | Units, expense categories, Owner account, default settings |
| Authentication (login, session lock, PIN change) | Argon2id hashing via `argon2` npm package |
| Authorization service stub | `auth.can(actor, permission)` always returns true in Phase 1 |
| IPC framework | All handler registration, error envelope format |
| Audit log infrastructure | Writer function; called from all service handlers |
| GitHub Actions CI | macOS test run + Windows build |
| electron-builder config | NSIS installer, auto-update stub |

---

### Sprint 1 — Item Catalog (2 weeks)

**Goal:** Owner can configure the full item catalog before any billing or processing.

| Deliverable | Module(s) |
|---|---|
| Unit management CRUD | `units`, `item_units` |
| Item CRUD (with type flags) | `items` |
| Variant management | `variants` (including auto-default variant) |
| Pricing with history | `prices` — versioned; never in-place update |
| Item search (by name, type) | Used by billing and processing screens |
| Opening stock entry | `inventory_transactions` with `tx_type = 'opening'` |
| Unit tests: pricing resolution, unit conversion | Domain layer |

---

### Sprint 2 — Inventory Core (2 weeks)

**Goal:** Stock-in, inventory views, adjustments, and negative-stock guard.

| Deliverable | Module(s) |
|---|---|
| Supplier CRUD | `suppliers` |
| Stock-in flow | `stock_ins` → `inventory_transactions` |
| Inventory current-stock view | SUM-based; all four categories |
| Stock adjustment flow | `stock_adjustments` → `inventory_transactions` |
| Negative stock guard | Domain function; called from all deduction points |
| Reorder threshold configuration | `items.reorder_threshold` |
| Low-stock alert list | Dashboard + standalone view |
| Unit tests: inventory balance math | Domain layer |

---

### Sprint 3 — Processing Engine (2 weeks)

**Goal:** The mill can record both in-house and customer processing transactions.

*Prerequisites: Owner workshop to confirm processing rules, ratios, and product list.*

| Deliverable | Module(s) |
|---|---|
| Processing rule CRUD + versioning | `processing_rules`, `processing_rule_outputs` |
| Yield calculator (pure domain function) | `domain/processing-engine.ts` |
| In-house processing flow | `processing_transactions` → `inventory_transactions` |
| Customer processing flow | `processing_transactions` → `bills` → `inventory_transactions` |
| Expected vs. actual output entry | UI for operator override |
| Variance display | Expected − Actual per output line |
| Unit tests: yield calculation, all rule types | Domain layer |
| Integration test: in-house atomic rollback on failure | |

---

### Sprint 4 — Billing & Payments (2 weeks)

**Goal:** Full billing flow including fast-path keyboard UX, credit/udharo, and due collection.

| Deliverable | Module(s) |
|---|---|
| Bill creation (multi-line) | `bills`, `bill_lines`, `inventory_transactions`, `payments` |
| Fast-path keyboard flow | Per `05_USER_FLOWS.md` Flow 2 |
| Draft/hold bill | `bills.status = 'draft'` |
| Payment handling (all methods) | `payments` |
| Credit / udharo tracking | `bills.due_amount` |
| Due payment collection | Multi-bill payment application |
| Bill cancellation + compensating inventory | Per `05_USER_FLOWS.md` Flow 9 |
| Product return | `tx_type = 'return'` |
| Customer CRUD + inline creation | `customers` |
| Unit tests: bill total calculation, VAT, discount | Domain layer |
| Integration test: bill + inventory atomic rollback | |

---

### Sprint 5 — Thermal Printing (2 weeks)

**Goal:** Bills print correctly on an 80mm ESC/POS printer; reprint works; print failure is handled gracefully.

| Deliverable | Module(s) |
|---|---|
| ESC/POS byte buffer builder | `infrastructure/printer.ts` |
| 80mm bill template | Per `04_MODULES/PRINTING.md` layout |
| On-screen bill preview (pre-print) | Rendered in renderer as a formatted preview |
| Print pipeline (save-then-print) | Printer failure does not block save |
| Reprint (DUPLICATE COPY marker) | `bills.is_reprinted`, `audit_log` |
| Printer configuration in Settings | Port, width, cut mode |
| Test print function | Settings → Test Print |
| Windows serial port testing | Via CI on windows-latest runner |
| 58mm template (secondary) | Configurable fallback |

---

### Sprint 6 — Expenses & Reporting (2 weeks)

**Goal:** Owner can log expenses and run all standard reports with export.

| Deliverable | Module(s) |
|---|---|
| Expense category CRUD | `expense_categories` |
| Expense CRUD | `expenses` |
| Sales Report | Per `04_MODULES/REPORTING.md` Section 3.1 |
| Processing Report | Section 3.2 |
| Inventory Report (opening/closing) | Section 3.3 |
| Product Report | Section 3.4 |
| Customer Report + aging buckets | Section 3.5 |
| Supplier Report | Section 3.6 |
| Expense Report | Section 3.7 |
| Financial Summary (P&L overview) | Section 3.8 |
| PDF export (`@react-pdf/renderer`) | All reports |
| XLSX export (`exceljs`) | All reports |
| Dashboard summary tiles with real-time refresh | Per `04_MODULES/REPORTING.md` Section 6 |

---

### Sprint 7 — Backup, Audit & Security (2 weeks)

**Goal:** Data is safe; sensitive actions are audited; the system is production-hardened.

| Deliverable | Module(s) |
|---|---|
| Automatic backup scheduler | Daily + weekly triggers in Electron main |
| Manual "Backup Now" | Settings + Dashboard shortcut |
| Backup retention + pruning | 14 daily + 8 weekly |
| Validated restore flow | Checksum + schema version + safety copy |
| Backup failure notification | Persistent UI alert |
| Audit log viewer | Searchable audit_log table in Settings |
| Hash-chained audit rows | `prev_hash` + `row_hash` computed on insert |
| Argon2id password hardening review | Cost factor tuning for target hardware |
| Optional SQLCipher toggle | Settings → Data Security |
| electron-builder code signing | macOS: ad-hoc; Windows: self-signed cert for Phase 1 |

---

### Sprint 8 — Compliance, Polish & UAT (2 weeks)

**Goal:** System is compliant, polished, and ready for live use.

| Deliverable | Module(s) |
|---|---|
| BS calendar everywhere | All date pickers, bill displays, reports |
| IRD bill format verification | With accountant sign-off |
| VAT toggle + per-item VAT flags | `settings.vat_enabled`, `bill_lines.is_taxable` |
| Fiscal year-aware bill numbering | Auto-reset in Shrawan |
| Nepal currency formatting (lakh system) | All monetary displays |
| Keyboard shortcut review | All flows completable without mouse |
| Performance testing | 500 k-row dataset; report < 2s target |
| Crash-recovery testing | Kill process mid-transaction; verify clean restart |
| Printer hardware testing on Windows | With actual 80mm printer |
| User acceptance testing (UAT) with owner | Walk through all Flows in `05_USER_FLOWS.md` |
| Setup wizard | First-run: mill name, PAN, printer, backup destination |
| Help text / tooltips | For non-obvious fields |

---

## 3. Phase 2–5 Roadmap

| Phase | Focus | Key Deliverables |
|---|---|---|
| **Phase 2** | Multi-user RBAC | Manager / Cashier / Inventory Manager roles; Manage Users screen; permission enforcement in all service handlers; barcode scanning exploration |
| **Phase 3** | Multi-terminal LAN | Networked database (LibSQL/Turso on a local server); concurrent bill creation with server-side sequencing; terminal-aware audit log |
| **Phase 4** | Cloud & Mobile | Cloud sync daemon; read-only mobile dashboard for owner; remote monitoring; SMS/WhatsApp due-payment reminders |
| **Phase 5** | Analytics | Seasonal demand forecasting; inventory optimization suggestions; year-over-year comparisons; accountant export portal |

---

## 4. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Owner's processing rules are more complex than initially modeled (multi-input blending) | Medium | High — rework of processing engine | Owner workshop before Sprint 3; schema supports multiple inputs even if Phase 1 UI exposes single-input only |
| Power instability causes mid-write crash | High (rural Nepal context) | High — data loss | WAL mode, atomic transactions (Sprint 0), crash-recovery test in Sprint 8 |
| IRD invoicing requirements change or are mis-scoped | Medium | Medium — non-compliant bills | Accountant review before Sprint 8 go-live; bill template is data-driven, not hard-coded |
| Backup destination unavailable for extended period | Medium | High — no recovery point | Multiple destinations; persistent failure alerts (Sprint 7) |
| Electron memory usage on 4 GB machine causes performance issues | Low | Medium | GPU acceleration disabled; lazy loading; monitor in Sprint 8 UAT |
| Windows printer port access issues (driver conflicts) | Medium | Medium — can't print | Test on actual hardware in Sprint 5; graceful print-failure handling already designed |
| Scope creep from Phase 2 features into Phase 1 | Medium | Medium — delayed launch | Strictly enforce Phase 1 scope; Phase 2 items tracked in backlog, not in Sprint plan |
| Owner enters incorrect processing ratios during setup | Medium | High — wrong yields silently | Setup wizard with preview calculation; ratio confirmation step before rule goes live |

---

## 5. Definition of Done (Per Sprint)

A sprint deliverable is done when:
- [ ] Feature works end-to-end in a running Electron app (not just unit tests)
- [ ] Domain layer unit tests pass (Vitest)
- [ ] Service layer integration test covers the happy path and a rollback scenario
- [ ] The Windows build produced by GitHub Actions installs and runs the feature
- [ ] No `console.error` output during normal operation
- [ ] Relevant `audit_log` rows are written for all sensitive actions
- [ ] The feature matches its specification in `04_MODULES/` docs

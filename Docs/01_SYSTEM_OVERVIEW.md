# 01 — System Overview

## 1. What We Are Building

The **Badachuli Rice Mill Billing & Inventory Management System** is an offline-first desktop application that replaces manual ledgers at a Nepali rice mill.

The mill operates **primarily as a service provider**: walk-in customers bring their own raw materials (paddy, mustard, corn, wheat, millet) and the mill processes them into finished products (rice, oil, flour) which the customers take home. The mill also sells products from its own stock. A distinctive feature of this mill's business model is the **byproduct-as-payment system**: for certain items, a customer can leave a valuable byproduct (e.g., rice bran/Dhuto, or mustard cake/Pina) with the mill in lieu of a cash processing fee — the entire fee logic is configurable by the owner per item.

The system covers the complete mill business cycle: receiving raw material, processing for customers or in-house, selling mill inventory via POS billing with thermal-printer output, tracking customer credit (udharo), recording supplier purchases and mill expenses, and generating accurate financial and operational reports — all without any internet dependency.

It is architected for a single owner-operator in Phase 1 and designed from the ground up to grow into multi-user, multi-terminal, and cloud-connected operation in later phases without a rewrite.

---

## 2. Business Problem

The mill currently runs on paper ledgers and manual calculations. This produces:

- **Billing errors** — hand-written bills with arithmetic mistakes
- **Inventory drift** — stock counts that diverge from actual sales/processing records over time
- **Credit tracking gaps** — outstanding udharo balances are imprecisely tracked, leading to collection problems
- **No reports** — there is no clear picture of daily revenue, processing yield, or profitability without manual tallying
- **No audit trail** — errors and corrections leave no traceable record
- **Data loss risk** — all records exist only on paper

---

## 3. System Objectives

1. Replace manual billing and inventory registers with a single, authoritative source of truth.
2. Maintain accurate, immutable records of every sales, processing, purchase, and adjustment transaction.
3. Track raw materials entering the mill and all outputs leaving processing.
4. Support items with and without variants, and with fully owner-configurable attributes.
5. Maintain real-time inventory across raw material, in-process, finished, and by-product stock.
6. Generate compliant, professional thermal-printed bills on an 80mm ESC/POS printer.
7. Generate accurate sales, processing, inventory, customer, supplier, expense, and financial reports — all computed from the transaction ledger.
8. Operate 100% offline with zero internet dependency for all core operations.
9. Provide automatic and manual backup with validated restore.
10. Track supplier purchases and mill expenses for a real profit-and-loss view.
11. Run comfortably on a Windows 10/11 PC with 4 GB RAM.
12. Provide a clean, keyboard-friendly UI that a non-technical mill operator can use daily.
13. Be architected so that Phases 2–5 (RBAC, multi-terminal, cloud sync, analytics) require no rewrite of the core.

---

## 4. Core Business Flow

```
Raw Material Received from Supplier
        ↓
Inventory Updated (raw_material stock +)
        ↓
Processing Triggered (In-House OR Customer)
        ↓
  ┌─────────────────────────────────────┐
  │ In-House             Customer       │
  │ Raw stock -          Raw recorded   │
  │ Output stock +       Processing     │
  │ No bill              bill generated │
  └─────────────────────────────────────┘
        ↓
Product Available for Sale
        ↓
Customer Purchase → Bill Generated → Inventory -
        ↓
Payment Collected (Cash / Bank / Udharo)
        ↓
Reports Updated (computed from ledger, always)
```

---

## 5. Scope

### Phase 1 — In Scope

| Module | Description |
|---|---|
| Authentication | Single owner login with PIN/password, session lock |
| Dashboard | Daily summary tiles, low-stock alerts, recent activity |
| Item & Variant Management | Full catalog, variants, units, pricing with history |
| Inventory Management | Four stock categories, ledger-based totals, adjustments |
| Processing Engine | Configurable rules, in-house and customer processing modes |
| Billing | Multi-line bills, fast keyboard path, draft/hold, reprint |
| Payment & Udharo | Cash/bank/digital/credit, partial payment, due collection |
| Thermal Printing | 80mm ESC/POS bill printing, preview, reprint |
| Customer Management | Profiles, credit tracking, payment history |
| Supplier Management | Profiles, purchase linking, payable balance |
| Expense Tracking | Category-based expense log, P&L integration |
| Reporting | Sales, Processing, Inventory, Customer, Financial reports |
| Backup & Restore | Scheduled auto-backup, validated restore |
| Settings | Mill profile, printer config, VAT toggle, bill numbering, BS calendar |
| Audit Log | Append-only trail for all sensitive actions |
| BS Calendar | All customer-facing dates in Bikram Sambat |

### Phase 1 — Explicitly Out of Scope

- Multi-user login and permission enforcement (schema ready; UI ships Phase 2)
- LAN multi-terminal operation (Phase 3)
- Cloud synchronization, mobile app (Phase 4)
- Forecasting and advanced analytics (Phase 5)
- Payroll, HR, or general accounting beyond mill operations
- Barcode scanning (Phase 2 candidate)
- Scale/weighbridge integration (Phase 2 candidate)

---

## 6. Stakeholders

### Phase 1 Roles

| Role | Phase 1 Status | Description |
|---|---|---|
| Owner | Active — full access | Mill owner; only operator in Phase 1 |
| Manager | Schema only | Will be activated in Phase 2 |
| Cashier | Schema only | Will be activated in Phase 2 |
| Inventory Manager | Schema only | Will be activated in Phase 2 |
| Accountant | Schema only | Will be activated in Phase 2 |

The permission system must be wired through a single authorization service from Sprint 0, even though only the Owner role is enforced in Phase 1. Phase 2 adds roles by inserting rows into the permissions table — not by adding new code paths.

### Phase 2+ Permission Matrix (Design Target)

| Permission | Owner | Manager | Cashier | Inv. Mgr | Accountant |
|---|---|---|---|---|---|
| Create Bill | ✓ | ✓ | ✓ | ✗ | ✗ |
| View Inventory | ✓ | ✓ | Limited | ✓ | Limited |
| Modify Items / Pricing | ✓ | ✓ | ✗ | Limited | ✗ |
| Configure Processing Rules | ✓ | ✓ | ✗ | ✗ | ✗ |
| Cancel / Delete Transactions | ✓ | ✗ | ✗ | ✗ | ✗ |
| View Reports | ✓ | ✓ | Limited | Limited | ✓ |
| Manage Users & Roles | ✓ | ✗ | ✗ | ✗ | ✗ |
| Backup / Restore | ✓ | ✗ | ✗ | ✗ | ✗ |

---

## 7. Glossary

| Term | Definition |
|---|---|
| **Item** | A material or product tracked by the mill (raw material, processed product, or by-product). |
| **Variant** | A specific sellable form of an Item (e.g., Chamal → Mansuli, Jeera Masino). Items without variants use a system-generated default variant internally. |
| **Processing Rule** | A configurable input→output recipe defining yield ratios (e.g., 100 kg Dhan → 65 kg Chamal + 25 kg Bhus + 10 kg loss). |
| **In-House Processing** | The mill converts its own raw material stock into product stock. No bill is generated. |
| **Customer Processing** | A customer brings their own material for the mill to process for a fee. A processing bill is generated. |
| **Udharo** | Nepali term for credit/due sales. When a customer pays less than the bill total, the remainder is tracked as udharo against their account. |
| **IRD** | Inland Revenue Department (Nepal). Governs VAT rates and bill content requirements for registered businesses. |
| **BS** | Bikram Sambat — the Nepali calendar system. Nepal's standard commercial calendar. All customer-facing dates display in BS; all internal storage uses AD. |
| **WAL** | Write-Ahead Logging — a SQLite journaling mode that prevents data loss on power failure and improves concurrent read performance. |
| **RBAC** | Role-Based Access Control — the permission model used from Phase 2 onward. |
| **ESC/POS** | A thermal printer command protocol used by nearly all receipt printers. Commands are raw byte sequences. |
| **Ledger-centric** | The architectural principle that all stock levels and financial totals are *computed* from the transaction ledger at read time, never stored as independently editable numbers. |
| **Compensating transaction** | A transaction that reverses the effect of a prior transaction (e.g., a cancellation or return adds a compensating row to the inventory ledger instead of deleting the original row). |
| **Bora / Sack** | A large sack used to measure grain. 1 Bora = 50 kg (standard for rice in Nepal; confirm with owner). |

---

## 8. Assumptions & Constraints

1. The application runs on a single dedicated Windows 10/11 PC with 4 GB RAM. Electron with careful optimization is the accepted shell.
2. A single Owner account is used at launch. All writable rows carry `operator_id` from day one.
3. An 80mm ESC/POS-compatible thermal printer is connected via USB. The system must also support 58mm as a settings option.
4. Processing recipes are not fixed constants — they are configurable data, editable through the UI.
5. Nepal business context applies: BS calendar dates on all customer-facing outputs, IRD-compliant bill format, VAT flag configurable per item.
6. VAT registration status is pending confirmation with the mill's accountant. The system is designed to work correctly whether VAT is enabled or disabled.
7. No internet connectivity is assumed or required for any Phase 1 operation.
8. The mill owner is the sole operator in Phase 1. Staff may be added in Phase 2.
9. All monetary values are in Nepali Rupees (NRs / NPR). No multi-currency support is needed.
10. Nepal's fiscal year runs mid-July to mid-July (Shrawan to Ashadh). Bill numbering and annual reports align to this fiscal year.

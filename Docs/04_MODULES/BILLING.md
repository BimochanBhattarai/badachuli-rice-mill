# Module — Billing

## 1. Purpose

The Billing module is the primary customer-facing operation of the system. It creates sales bills for product purchases and processing services, handles payments (including partial credit/udharo), manages draft bills, and drives the thermal print pipeline. Everything the customer receives as a paper receipt originates here.

---

## 2. Functional Requirements

| ID | Requirement |
|---|---|
| FR-BILL-01 | A single bill supports multiple item/variant lines, each with quantity, unit, rate (auto-filled, manually overridable), line discount, and computed line total. |
| FR-BILL-02 | Every bill captures: unique sequential bill number, date (AD + BS), customer or walk-in, operator, subtotal, bill-level discount, VAT (if applicable), grand total, payment status, and payment method. |
| FR-BILL-03 | The billing screen supports the full flow via keyboard only, completable in ≤ 5 interactions for a single-item cash sale. |
| FR-BILL-04 | An in-progress bill can be parked (draft/hold) and resumed later without losing entered lines. |
| FR-BILL-05 | Any historical bill is reprintable byte-for-byte identical to the original, regardless of subsequent price or item changes, stamped "DUPLICATE COPY". |
| FR-BILL-06 | Bill cancellation sets status = CANCELLED with reason, actor, timestamp; automatically reverses inventory via a compensating transaction; and excludes the bill from revenue totals while keeping it in audit reports. |
| FR-BILL-07 | Product returns are recorded as a separate transaction type linked to the original bill, restoring inventory and adjusting the customer's balance. |

---

## 3. Bill Number Format

```
<PREFIX>-<FISCAL_YEAR_BS>-<SEQUENCE>

Example:  BRM-2081-00142
          BRM  = configurable mill prefix
          2081 = Nepali fiscal year (e.g. 2081/82)
          00142 = zero-padded sequential number, resets each fiscal year
```

**Rules:**
- Bill numbers are sequential and never reused — not even for cancelled bills.
- The sequence resets at the start of each Nepali fiscal year (Shrawan / mid-July).
- The prefix and next number are configurable in Settings.
- Bill number generation is handled inside the service layer's DB transaction to guarantee uniqueness under any concurrency scenario.

---

## 4. Screen Flow

### 4.1 Fast-Path — Single Item, Cash Sale (≤ 5 keyboard interactions)

```
[1] Select customer     → Type customer name or press Enter for Walk-in
[2] Search item         → Type item name, press Enter to select
[3] Enter quantity      → Type qty, Tab to move to unit field if needed
[4] Confirm line total  → Press Enter; rate auto-filled from active price list
[5] Complete            → Press F10 or Enter on "Cash" button → Print → Saved
```

### 4.2 Full Multi-Line Bill Flow

```
Start New Bill
    │
    ▼
Select Customer (search by name/phone, or Walk-in)
    │
    ▼
Add Line Items (loop):
    ├── Search item by name
    ├── Select variant (or auto-select default)
    ├── Enter quantity
    ├── Select unit (default = stocking unit)
    ├── Rate auto-filled from active price (editable if authorized)
    ├── Line discount (optional)
    └── Add another line or proceed
    │
    ▼
Bill-level discount (optional)
    │
    ▼
VAT applied if enabled (computed automatically)
    │
    ▼
Grand total displayed
    │
    ▼
Enter payment:
    ├── Method: Cash / Bank / Digital / Credit (udharo)
    ├── Amount paid (change displayed for cash overpayment)
    └── Due amount auto-computed (grand_total - paid_amount)
    │
    ▼
Preview bill (on-screen thermal-format preview)
    │
    ▼
Confirm & Print
    │
    ├── Bill saved to DB (atomic: bill + lines + inventory movements + payment)
    └── ESC/POS print command sent to printer
        (if printer offline: bill saves successfully, print error shown separately)
```

### 4.3 Draft / Hold Bill

- Press F9 (or "Hold" button) at any point during line entry to park the bill.
- Draft bills are stored with `status = 'draft'` — they do NOT trigger inventory deductions.
- A draft bill counter appears on the sidebar. Pressing "Resume" opens the held bill.
- Only one draft per session in Phase 1 (multiple drafts in Phase 2).

---

## 5. Business Rules

1. **Rate snapshot is immutable after save.** The `rate_snapshot` field on each `bill_line` is set once at bill creation and is never updated, regardless of future price changes.

2. **Inventory deduction is atomic with bill creation.** If the inventory deduction fails (e.g., negative stock blocked), the entire bill transaction rolls back. No partial bill.

3. **Bill number is unique and never reused.** Even a cancelled bill retains its number. The sequence has no gaps from the system's perspective (user-visible gaps can appear when bills are cancelled, which is expected and acceptable).

4. **Walk-in bills have no customer_id.** `customer_id = NULL` represents an anonymous walk-in. Walk-in bills cannot have credit/udharo — payment must be full.

5. **Credit/udharo requires a registered customer.** The system blocks credit payments for walk-in sales.

6. **Overriding the default rate requires the `OVERRIDE_PRICE` permission.** In Phase 1 (Owner only), this is always allowed. Phase 2 will enforce this per role.

7. **VAT is computed on the taxable subtotal only.** Non-taxable lines contribute to the subtotal but not to `taxable_amount` or `vat_amount`.

8. **A cancelled bill's inventory is always restored.** No manual step is required — the service layer issues compensating `inventory_transactions` rows automatically.

---

## 6. Payment Handling

| Method | Description | Due Allowed? |
|---|---|---|
| Cash | Full or partial; change computed if overpaid | Yes (if partial) |
| Bank Transfer | Full or partial; reference number recorded | Yes (if partial) |
| Digital Wallet | eSewa, Khalti, etc.; reference number recorded | Yes (if partial) |
| Credit (Udharo) | Full amount deferred; requires registered customer | — |
| Byproduct Offset | Processing fee waived; customer left a byproduct with the mill. Amount = NRs 0. Only valid on processing bills. | No |
| Mixed | E.g., partial cash + partial udharo | Yes |

When `paid_amount < grand_total`, the system:
1. Sets `bills.due_amount = grand_total - paid_amount`
2. Updates the customer's computed outstanding balance immediately
3. Shows the customer in the "Due Customers" section of the dashboard

---

## 7. Collecting a Due Payment Later

The due payment flow is separate from billing:

```
Customers → Select customer → "Collect Payment"
    │
    ▼
List of outstanding bills (oldest first by default)
    │
    ▼
Operator enters payment amount and method
    │
    ▼
System applies payment to the oldest due bills first (configurable)
    │
    ▼
Payments table gets a new row for each bill touched
bills.paid_amount and bills.due_amount updated
Customer outstanding balance recomputed
```

---

## 8. Integration Points

| System | Interaction |
|---|---|
| Inventory | Bill save → `inventory_transactions` rows inserted (qty_delta = negative for each sold line, converted to stocking unit) |
| Pricing | `prices` table queried for the active rate at bill time; result stored in `rate_snapshot` |
| Customers | `bills.customer_id` linked; `payments` linked to `customers.id` for balance computation |
| Printing | Bill data formatted as ESC/POS bytes and sent to printer; print failure does not block save |
| Audit Log | Every bill creation, cancellation, and price override writes an `audit_log` row |

---

## 9. Keyboard Shortcuts (Target)

| Key | Action |
|---|---|
| F1 | New Bill |
| F2 | Search customer |
| F3 | Search / add item line |
| F9 | Hold bill (draft) |
| F10 | Complete & print |
| Escape | Cancel current action |
| Tab / Shift+Tab | Navigate fields |
| Enter | Confirm selection / move to next field |

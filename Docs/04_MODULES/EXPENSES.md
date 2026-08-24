# Module — Expense Tracking

## 1. Purpose

The Expense module captures the mill's operating costs so that the Financial Summary report can show a meaningful net profit figure instead of gross revenue alone. Without expenses, "profit" is just sales revenue — which is misleading for any real business decision.

---

## 2. Expense Categories

Default categories (owner-configurable, can add/rename/deactivate):

| Category | Examples |
|---|---|
| Fuel & Energy | Diesel for generator, electricity bill |
| Labor | Daily wage workers, contract milling labor |
| Maintenance | Machine repair, spare parts, tools |
| Transport | Freight for raw material or product delivery |
| Rent | Mill premises or storage yard rent |
| Miscellaneous | Anything not covered above |

The owner can add custom categories from Settings.

---

## 3. Expense Record Fields

| Field | Type | Notes |
|---|---|---|
| `id` | Auto | |
| `category_id` | FK | Required |
| `amount` | Numeric | Required; must be > 0 |
| `expense_date` | Date | Required; defaults to today |
| `description` | Text | Required; "Diesel for 2081-05-08 milling" |
| `reference` | Text | Optional; receipt/voucher number |
| `operator_id` | FK | Who recorded it |
| `created_at` | DateTime | |

---

## 4. Functional Requirements

| ID | Requirement |
|---|---|
| FR-EXP-01 | Owner can log an expense with category, amount, date, description, and optional voucher reference. |
| FR-EXP-02 | Expense categories are owner-configurable (add, rename, deactivate). |
| FR-EXP-03 | Expenses appear in the Expense Report and contribute to the Financial Summary's net profit calculation. |
| FR-EXP-04 | Expenses can be edited or deleted within the same business day; older entries require the `EDIT_EXPENSE` permission and are audit-logged. |

---

## 5. UI Flow

```
Expenses → New Expense
    │
    ├── Category: [dropdown]
    ├── Amount: NRs ______
    ├── Date: [today by default]
    ├── Description: _____________
    └── Reference/Voucher: ______ (optional)
    │
    ▼
Save → INSERT expenses row → audit_log entry
```

---

## 6. Integration with Financial Summary

```
Financial Summary for 2081-04-01 to 2081-04-30:

  Gross Sales Revenue:       NRs 4,85,000
  Less: Returns/Cancels:     NRs   12,000
  Net Sales Revenue:         NRs 4,73,000
  Processing Income:         NRs   18,500
  ─────────────────────────────────────────
  Total Income:              NRs 4,91,500

  Raw Material Cost (est.):  NRs 2,80,000   ← SUM(stock_ins.total_cost) for consumed items
  Operating Expenses:        NRs   45,200   ← SUM(expenses.amount) for the period
  ─────────────────────────────────────────
  Estimated Net Profit:      NRs 1,66,300
```

---

## 7. Business Rules

1. **Expenses are associated with the date of the expense, not the recording date.** An operator can back-date an expense (e.g., entering yesterday's fuel cost today).
2. **Editing a past expense requires audit logging.** Any change after the same-day window writes a before/after record to `audit_log`.
3. **Deletion is soft only.** Expenses are marked `deleted = 1` and excluded from calculations; they cannot be permanently removed (consistent with no-hard-delete policy across the system).

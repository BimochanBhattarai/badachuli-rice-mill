# Module — Customer Management

## 1. Purpose

The Customer module maintains profiles for repeat customers, tracks their purchase history, and manages the udharo (credit/due) system. Outstanding balances are always computed from bills and payments — never stored as an editable field.

---

## 2. Customer Profile Fields

| Field | Type | Notes |
|---|---|---|
| `id` | Auto | Internal ID |
| `name` | Text | Required |
| `phone` | Text | Optional; duplicate detection on create |
| `address` | Text | Optional |
| `notes` | Text | Free-text notes (e.g., "Buys Mansuli variety only") |
| `active` | Boolean | Soft delete; inactive customers hidden from billing dropdown |
| `created_at` | DateTime | |

**Computed (not stored):**
- Total lifetime purchases
- Total paid
- Outstanding balance (udharo)
- Last purchase date

---

## 3. Functional Requirements

| ID | Requirement |
|---|---|
| FR-CUST-01 | Customer records include ID, name, phone, address, notes, transaction history, and computed outstanding balance. |
| FR-CUST-02 | A customer can be created inline during billing without leaving the billing screen. |
| FR-CUST-03 | Billing also supports an anonymous walk-in customer with no registration required. |
| FR-CUST-04 | On customer creation, the system warns (but does not block) if an existing customer shares the same phone number. |
| FR-CUST-05 | The system allows recording a payment against one or more previously due bills, updating payment status and outstanding balance. |

---

## 4. Walk-in Customer

- Represented internally by `customer_id = NULL` on a bill.
- No credit/udharo allowed for walk-in sales — must be fully paid at the time of billing.
- Walk-in bill history is accessible from the Bills section but not from a customer profile.

---

## 5. Outstanding Balance Computation

```sql
SELECT
  c.id,
  c.name,
  c.phone,
  COALESCE(SUM(b.grand_total) FILTER (WHERE b.status = 'active'), 0)  AS total_billed,
  COALESCE(SUM(p.amount), 0)                                           AS total_paid,
  COALESCE(SUM(b.due_amount) FILTER (WHERE b.status = 'active'), 0)   AS outstanding_balance,
  MAX(b.bill_date_ad)                                                  AS last_purchase_date
FROM customers c
LEFT JOIN bills    b ON b.customer_id = c.id
LEFT JOIN payments p ON p.customer_id = c.id
WHERE c.id = :id
GROUP BY c.id;
```

This query is used for the customer detail screen. For the customer list, an indexed view or the same query with pagination is used.

---

## 6. Customer Detail Screen

```
Customer: Ram Bahadur Thapa
Phone: 9841XXXXXX  |  Address: Kohalpur  |  Active: Yes

Outstanding Balance:  NRs 4,500.00   ← highlighted in red if > 0
Total Purchased:      NRs 85,000.00
Last Purchase:        2081-05-10

[Collect Payment]  [Edit]  [Deactivate]

─────────────────────────────────────────
TRANSACTION HISTORY
─────────────────────────────────────────
Date          Bill No       Total      Paid       Due     Status
2081-05-10    BRM-2081-0142  7,200     2,700      4,500   Due
2081-04-28    BRM-2081-0131  5,400     5,400      0       Paid
...
─────────────────────────────────────────
DUE BILLS (sorted by oldest first)
─────────────────────────────────────────
BRM-2081-0142  |  Due: NRs 4,500  |  47 days overdue
```

---

## 7. Collecting a Due Payment

```
Customer Detail → [Collect Payment]
    │
    ▼
Show list of outstanding (due) bills for this customer, oldest first
    │
    ▼
Operator enters:
    ├── Amount received
    └── Payment method (cash / bank / digital)
    │
    ▼
System applies payment to oldest bill first (FIFO), then next, etc.
  For each bill touched:
    - INSERT INTO payments (bill_id, customer_id, amount, method, ...)
    - UPDATE bills SET paid_amount = paid_amount + applied, due_amount = due_amount - applied
    │
    ▼
Print payment receipt (optional)
Write audit_log: PAYMENT_COLLECTED
```

All updates happen in a single DB transaction.

---

## 8. Inline Customer Creation During Billing

When the operator types a name that doesn't match any existing customer:
1. A "Create new customer" option appears at the bottom of the search dropdown.
2. A minimal inline form opens (name + phone).
3. On save, the new customer is created and immediately selected for the current bill.
4. Full profile editing is available from the Customers section later.

---

## 9. Business Rules

1. **Outstanding balance is always computed, never stored.** Any manual edit to a balance would require either deleting a payment or editing a bill — both of which are blocked by the no-hard-delete rule.
2. **Credit sales require a registered customer.** Walk-in sales must be paid in full.
3. **Deactivated customers are retained in history.** Deactivation hides the customer from the billing dropdown but preserves all historical bill and payment records.
4. **Duplicate phone warning does not block creation.** A rice mill may legitimately have two customers with the same family phone number. The warning exists to prompt the operator to double-check, not to enforce uniqueness.
5. **Payment is always linked to a customer, not just a bill.** Even if a payment settles multiple bills, each payment record has `customer_id` set for correct balance computation.

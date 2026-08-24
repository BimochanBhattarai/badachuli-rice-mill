# Module — Supplier Management

## 1. Purpose

The Supplier module tracks the businesses or individuals who sell raw materials to the mill (farmers, traders, wholesale suppliers). It links purchase (stock-in) records to suppliers and provides a running view of what the mill owes. Phase 1 treats payable balances as informational; formal purchase payment tracking is a Phase 2 enhancement.

---

## 2. Supplier Profile Fields

| Field | Type | Notes |
|---|---|---|
| `id` | Auto | Internal ID |
| `name` | Text | Required |
| `phone` | Text | Optional |
| `address` | Text | Optional |
| `notes` | Text | Free-text (e.g., "Supplies Mansuli paddy from Bardiya") |
| `active` | Boolean | Soft delete |
| `created_at` | DateTime | |

**Computed:**
- Total purchased (qty + cost) in a period
- Total paid (manual entry in Phase 1)
- Outstanding payable (purchased cost − paid)

---

## 3. Functional Requirements

| ID | Requirement |
|---|---|
| FR-SUPP-01 | Supplier profiles include name, phone, address, notes, and link to stock-in history. |
| FR-SUPP-02 | Stock-in transactions optionally link to a supplier; unlinking is allowed for casual/unknown purchases. |
| FR-SUPP-03 | The supplier detail screen shows total purchased (kg and cost), total paid, and outstanding payable. |
| FR-SUPP-04 | Suppliers can be created inline during a stock-in entry. |

---

## 4. Supplier Detail Screen

```
Supplier: Hari Prasad Sharma (Farmer)
Phone: 9857XXXXXX  |  Address: Rapti-5, Banke  |  Active: Yes

This Period (2081-01-01 to 2081-05-31):
  Total Purchased:  NRs 125,000  (2,500 kg)
  Total Paid:       NRs 100,000  (manually recorded)
  Outstanding:       NRs 25,000  ← payable to supplier

[Record Payment to Supplier]  [Edit]

─────────────────────────────────────────
PURCHASE HISTORY
─────────────────────────────────────────
Date          Item        Qty      Rate     Total
2081-05-08    Dhan        500 kg   45/kg    22,500
2081-04-15    Dhan        800 kg   44/kg    35,200
...
```

---

## 5. Stock-In with Supplier Link

```
Inventory → Stock In → New Entry
    │
    ├── Item: Dhan (Paddy)
    ├── Supplier: [search or create inline]  ← optional
    ├── Quantity: 500 kg
    ├── Purchase rate: 45.00 /kg
    ├── Total cost: 22,500 (auto-computed)
    ├── Date: 2081-05-08
    └── Notes: "Vehicle Koshi 2 Ka 7456"
    │
    ▼
INSERT stock_ins (item_id, supplier_id, qty, purchase_rate, total_cost, ...)
INSERT inventory_transactions (tx_type='stock_in', qty_delta=+500, ...)
```

---

## 6. Phase 1 vs Phase 2 Scope

| Feature | Phase 1 | Phase 2 |
|---|---|---|
| Supplier profiles | ✓ | ✓ |
| Link stock-in to supplier | ✓ | ✓ |
| Purchase history view | ✓ | ✓ |
| Record payment to supplier (manual entry) | ✓ (simple) | ✓ (with payment receipts) |
| Formal purchase orders | ✗ | ✓ |
| Supplier payment aging | ✗ | ✓ |

---

## 7. Business Rules

1. **Supplier link on stock-in is optional.** The mill sometimes buys from unknown individuals — these stock-ins are recorded without a supplier.
2. **Supplier payable is informational in Phase 1.** The outstanding amount shown is `(SUM of stock_in.total_cost) - (manually entered paid amount)`. It is not connected to a formal payment ledger yet.
3. **Deactivated suppliers are retained in history.** Their past stock-ins remain associated and visible.

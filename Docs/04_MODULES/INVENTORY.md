# Module — Inventory Management

## 1. Purpose

The Inventory module tracks the physical quantity of every item and variant across four stock categories. It is the backbone that all other modules write to: billing deducts stock, processing moves stock between categories, stock-in adds stock, and adjustments correct for real-world discrepancies. The module never stores a running total — all stock levels are computed from the `inventory_transactions` ledger.

---

## 2. Stock Categories

Every item/variant combination has stock tracked independently in four categories:

| Category | Key | What It Represents |
|---|---|---|
| Raw Material | `raw_material` | Unprocessed input material (e.g., paddy/Dhan waiting to be milled) |
| In-Process | `in_process` | Material that has entered the processing pipeline but not yet yielded outputs. Used for multi-day processing batches. |
| Finished / Sellable | `finished` | Processed products ready for sale (e.g., milled rice/Chamal, packed Bhus) |
| By-Product | `byproduct` | Secondary outputs from processing that may be sold separately (e.g., rice bran, broken rice) |

Most mills in Phase 1 will use `raw_material` and `finished` most heavily. `in_process` is available for multi-day batch scenarios. `byproduct` tracks separately sellable by-products.

---

## 3. How Stock Is Computed

Current stock is always `SUM(qty_delta)` from `inventory_transactions`, filtered by `(item_id, variant_id, stock_category)`.

```
Current Stock = Opening Stock
              + Stock Ins          (tx_type = 'stock_in',      qty_delta > 0)
              + Processed In       (tx_type = 'processed_in',  qty_delta > 0)
              - Processed Out      (tx_type = 'processed_out', qty_delta < 0)
              - Sales              (tx_type = 'sale',          qty_delta < 0)
              + Returns            (tx_type = 'return',        qty_delta > 0)
              ± Adjustments        (tx_type = 'adjustment',    qty_delta + or -)
```

No operation ever updates a stored stock number. This means any historical stock level — as of any date — can be reconstructed by filtering `inventory_transactions.created_at <= target_date`.

---

## 4. Functional Requirements

| ID | Requirement |
|---|---|
| FR-INV-01 | Stock is tracked per item/variant across four categories with full transaction history. |
| FR-INV-02 | Closing stock is always computed from the transaction ledger — never from an independently editable running total. |
| FR-INV-03 | A sale or processing operation that would drive stock negative is blocked unless the item has `allow_negative_stock = 1`. |
| FR-INV-04 | Manual stock corrections require a reason code and note; they are recorded as a first-class transaction, never as a silent edit. |
| FR-INV-05 | Each item has a configurable `reorder_threshold`; items at or below this threshold appear on the dashboard and in the Low Stock report. |
| FR-INV-06 | Stock-in transactions link to a supplier record (optional) and record purchase rate for cost tracking. |

---

## 5. Stock-In Flow

Stock-in records raw material received at the mill:

```
Inventory → Stock In → New Entry
    │
    ├── Select item (raw material type)
    ├── Select supplier (optional; leave blank if unknown/casual)
    ├── Enter quantity and unit
    ├── Enter purchase rate (optional; used in cost/P&L reporting)
    ├── Date (defaults to today)
    └── Notes (e.g., farmer name, vehicle number, lot reference)
    │
    ▼
System writes:
    stock_ins row (purchase record + supplier link)
    inventory_transactions row (tx_type = 'stock_in', stock_category = 'raw_material', qty_delta = +qty_in_base)
```

---

## 6. Negative Stock Guard

Before any stock-deducting operation (bill save, processing start):

```typescript
function checkStock(itemId: number, variantId: number, category: string, requiredQty: number): void {
  const current = inventoryRepo.getCurrentStock(itemId, variantId, category);
  const item    = itemRepo.findById(itemId);
  
  if (current - requiredQty < 0 && !item.allow_negative_stock) {
    throw new InsufficientStockError(
      `Cannot proceed: ${item.name} has ${current} ${item.unit} in stock; ${requiredQty} required.`
    );
  }
}
```

This check runs inside the same DB transaction as the stock deduction, so there is no race condition. The error propagates back to the UI as a user-readable message — the operator sees exactly which item is short and by how much.

---

## 7. Manual Stock Adjustment

Used for: physical recount discrepancy, damage/spillage, expiry, theft.

```
Inventory → Adjustments → New Adjustment
    │
    ├── Select item + variant
    ├── Select stock category
    ├── Enter quantity delta (positive to add, negative to remove)
    ├── Select reason code (damage / spillage / recount / expiry / theft / other)
    ├── Enter reason note (required for all adjustments)
    └── Date/time (defaults to now)
    │
    ▼
System writes:
    stock_adjustments row (full record with reason)
    inventory_transactions row (tx_type = 'adjustment', qty_delta = entered delta)
    audit_log row (actor, action = 'STOCK_ADJUSTED', before/after quantities, reason)
```

Adjustments are visible in the Inventory Report and Audit Log. They cannot be deleted — only corrected by adding another adjustment with an explanatory note.

---

## 8. How Processing Moves Stock

### In-House Processing
```
Raw Material stock (raw_material category) — input_qty
    ↓ inventory_transactions row: tx_type='processed_out', qty_delta = -input_qty

Finished/By-Product stock (finished or byproduct category) + output_qty per item
    ↓ inventory_transactions rows: tx_type='processed_in', qty_delta = +actual_output_qty
```

### Customer Processing
- If the customer brings their own material (most common): NO raw_material stock change at the mill.
- A `processing_transactions` row is created with the material and quantity noted for record.
- A bill is generated for the processing charge.
- If the mill retains part of the output (e.g., bran as an in-kind fee): those output items get `processed_in` inventory_transactions rows.

---

## 9. Inventory Views in the UI

| View | Description |
|---|---|
| Current Stock Summary | Table: item / variant / category / current qty / unit / reorder threshold / status |
| Stock History for Item | Timeline of all `inventory_transactions` for a selected item/variant |
| Low Stock Alerts | Items where `current_stock ≤ reorder_threshold` |
| Stock Ledger | Full transaction log with filters: date range, item, category, transaction type |
| Stock Valuation | Current stock × purchase rate (where available) for a rough inventory value estimate |

---

## 10. Business Rules

1. **No direct edits to inventory numbers.** All stock changes go through a transaction row. The UI never exposes an "edit stock to X" field.
2. **All writes are atomic.** Bill save + inventory deduction happen in one SQLite transaction. A failed print does not undo the sale.
3. **Unit conversion happens at write time.** When a line item is entered in a different unit than the stocking unit, the conversion (`item_units.to_stocking_factor`) is applied and `qty_in_base` (the stocking-unit quantity) is what gets written to `inventory_transactions`. Reports always aggregate in the stocking unit.
4. **Stock adjustments require a reason.** The reason code and note are NOT NULL in the service layer, even if the DB column is nullable for legacy migration purposes.
5. **Opening stock is a transaction.** When setting up a new item with existing stock, the operator enters an opening quantity, which is recorded as `tx_type = 'opening'` in `inventory_transactions`. This preserves the ledger-only principle.

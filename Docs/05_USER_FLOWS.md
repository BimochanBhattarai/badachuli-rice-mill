# 05 — User Flows

## How to Read These Flows

Each flow below is a step-by-step narrative of what the operator does and what the system does in response. They describe the **happy path** (everything works) with **failure branches** noted at the end of each flow.

---

## Flow 1 — Daily Opening

*Every business morning.*

```
1. Operator launches the app → Login screen appears
2. Enter PIN → Dashboard loads
3. Review dashboard tiles:
   - Today's Sales: NRs 0 (start of day)
   - Outstanding Due: NRs 14,500 (carry-over from previous days)
   - Low Stock Alerts: 2 items (shown in red)
4. Click "Low Stock" alert → Inventory list filtered to below-threshold items
5. Decide whether to order more stock or adjust reorder thresholds
6. Ready to begin operations
```

---

## Flow 2 — Fast-Path Cash Sale (Core Billing — ≤ 5 Interactions)

*Most common daily operation.*

```
[F1] New Bill
  Keyboard focus is on customer search field.

[1] Press Enter → Walk-in customer selected (no registration needed)
    OR type customer name and press Enter to select from dropdown

[2] Press F3 → item search field focused
    Type "Chamal" → dropdown shows matching items
    Press Enter → Chamal selected; variant dropdown appears if >1 variant
    Press Enter → default variant selected (or navigate with ↑↓ to choose a specific one)

[3] Qty field focused automatically
    Type "50" → line total computed: 50 × 72.00 = NRs 3,600.00

[4] Press Enter → line added; "Add another item?" prompt
    Press Escape or Enter on "Done" → bill summary shown

[5] Cash field is focused automatically
    Type "4000" → Change: NRs 400.00 shown
    Press Enter → bill confirmed, saved, ESC/POS print command sent

System:
  - Bill BRM-2081-XXXXX created
  - inventory_transactions row: Chamal -50 kg
  - Payment row: cash NRs 3,600
  - ESC/POS buffer sent to printer
  - Toast: "Bill saved and printed"
```

Total: 5 keyboard interactions for a single-item cash sale. ✓

---

## Flow 3 — Credit Sale (Udharo)

*Customer doesn't pay in full.*

```
1. New Bill → Select customer: Ram Bahadur Thapa
2. Add line items (same as Flow 2)
3. Grand Total: NRs 7,200

At payment step:
4. Enter paid amount: 2,700 (partial)
   System shows:
     Paid:  NRs 2,700
     Due:   NRs 4,500
5. Payment method: select "Cash + Credit (Udharo)"
6. Confirm → bill saved with due_amount = 4,500

Dashboard now shows Ram Bahadur Thapa in outstanding due list.
Customer profile shows outstanding balance: NRs 4,500.
```

---

## Flow 4 — Collecting a Due Payment

*Customer comes to pay outstanding balance.*

```
1. Customers → Search "Ram Bahadur Thapa"
2. Customer profile shows: Outstanding: NRs 4,500

3. Click [Collect Payment]
4. Outstanding bills listed:
     BRM-2081-0142  Due: NRs 4,500  |  47 days old

5. Enter payment:
     Amount: NRs 4,500
     Method: Cash

6. Confirm
System:
  - INSERT payments (bill_id=142, customer_id=X, amount=4500, method='cash')
  - UPDATE bills SET paid_amount=7200, due_amount=0 WHERE id=142
  - Customer outstanding balance → NRs 0
  - audit_log: PAYMENT_COLLECTED

7. Optional: print payment receipt
```

---

## Flow 5 — In-House Processing (Dhan → Chamal)

*Mill processes its own paddy stock.*

```
1. Processing → New Transaction → In-House

2. Select rule: "Dhan → Chamal (Standard)"
   Rule: 100 kg Dhan → 65 kg Chamal + 25 kg Bhus + 8 kg Chora + 2 kg waste

3. Enter input quantity: 1,000 kg Dhan
   System shows expected outputs:
     Chamal:  650 kg
     Bhus:    250 kg
     Chora:    80 kg
     Waste:    20 kg

4. After milling, operator enters actual measurements:
     Chamal:  648 kg   (variance: -2 kg)
     Bhus:    252 kg   (variance: +2 kg)
     Chora:    79 kg   (variance: -1 kg)
     Waste:    21 kg

5. Notes: "Slightly lower Chamal yield due to high moisture in batch"
6. Confirm

System (single DB transaction):
  - INSERT processing_transactions (mode='in_house', input_qty=1000, ...)
  - INSERT inventory_transactions: Dhan -1000 kg (raw_material, processed_out)
  - INSERT inventory_transactions: Chamal +648 kg (finished, processed_in)
  - INSERT inventory_transactions: Bhus +252 kg (byproduct, processed_in)
  - INSERT inventory_transactions: Chora +79 kg (byproduct, processed_in)
  - [Waste: not inserted to inventory]
  - audit_log: PROCESSING_COMPLETED
```

---

## Flow 6 — Customer Processing

*A farmer brings his own paddy for milling.*

```
1. Processing → New Transaction → Customer Processing

2. Select customer: Hari Prasad Sharma (or create inline)
3. Select rule: "Dhan → Chamal (Standard)"

4. Input: 500 kg Dhan (customer's material)
   Expected outputs shown

5. Processing charge: NRs 2.50/kg → NRs 1,250 auto-filled
   (from 'processing' price for Dhan; overridable)

6. Output disposition: "All returned to customer" (most common)

7. Actual outputs entered (same as Flow 5 but for 500 kg)

8. Confirm

System:
  - INSERT processing_transactions (mode='customer', customer_id=X, charge=1250)
  - No raw_material inventory change (customer's material, not mill's stock)
  - INSERT bill (bill_type='processing', grand_total=1250)  ← ALWAYS generated; NRs 0 if waived
  - INSERT bill_lines (processing charge line)
  - INSERT payments OR set due_amount if udharo (skipped if grand_total=0)
  - Print bill immediately → customer hands printed bill to mill operator as work-order authorization
```

---

## Flow 7 — Receiving Raw Material (Stock-In)

*Supplier delivers paddy to the mill.*

```
1. Inventory → Stock In → New Entry

2. Item: Dhan (Paddy)
3. Supplier: Hari Prasad Sharma [search or create inline]
4. Quantity: 2,000 kg
5. Unit: kg (default)
6. Purchase rate: NRs 45.00 /kg
   Total cost: NRs 90,000 (auto-computed)
7. Date: 2081-05-08 (today)
8. Notes: "Vehicle: Kohalpur Jeep 001"
9. Confirm

System:
  - INSERT stock_ins (item_id, supplier_id, qty=2000, purchase_rate=45, total_cost=90000)
  - INSERT inventory_transactions: Dhan +2000 kg (raw_material, stock_in)
  - Dashboard raw material stock updated immediately
```

---

## Flow 8 — Manual Stock Adjustment

*Physical recount finds discrepancy.*

```
1. Inventory → Adjustments → New Adjustment

2. Item: Chamal | Variant: Mansuli | Category: Finished
3. System shows current stock: 450 kg (per ledger)
4. Physical count: 442 kg
5. Qty delta: -8 (removing 8 kg from stock)
6. Reason code: Recount
7. Note: "Physical count 2081-05-10 — discrepancy likely from bagging losses"
8. Confirm

System:
  - INSERT stock_adjustments (qty_delta=-8, reason='recount', ...)
  - INSERT inventory_transactions: Chamal Mansuli -8 kg (adjustment)
  - audit_log: STOCK_ADJUSTED (before=450, after=442, reason)
```

---

## Flow 9 — Bill Cancellation

*Operator discovers a billing error.*

```
1. Bills → Search bill BRM-2081-0138
2. Open bill detail
3. Click [Cancel Bill]
4. Enter reason: "Wrong item selected — customer wanted Jeera, not Mansuli"
5. Confirm cancellation

System (single DB transaction):
  - UPDATE bills SET status='cancelled', cancel_reason='...', cancelled_at=now()
  - INSERT inventory_transactions: compensating row (+qty for each line, restoring stock)
  - audit_log: BILL_CANCELLED (actor, reason, bill_id, before_state)

Result:
  - Bill excluded from sales totals and revenue reports
  - Stock restored to pre-bill levels
  - Bill visible in Audit Log and Cancellation report
  - Bill number is retired — not reused
```

---

## Flow 10 — Generating and Exporting a Report

```
1. Reports → Sales Report

2. Set filters:
     Date range: 2081-04-01 to 2081-04-30 (or select "Last Month" preset)
     Calendar: BS

3. System runs query; results appear in < 2 seconds

4. Review table:
     Total sales: NRs 4,85,000
     Bills issued: 142
     Outstanding due: NRs 18,700
     Top item: Chamal Mansuli (1,450 kg sold)

5. Click [Export PDF] → PDF rendered and saved to Downloads folder
   OR [Export XLSX] → Excel file for accountant
```

---

## Flow 11 — Backup Now

```
1. Settings → Backup & Restore → [Backup Now]
   OR: Dashboard → [Backup Now] quick action

2. System shows:
     Destination: E:\Badachuli-Backups\  (USB drive)
     Last backup: 2081-05-07 at 11:00 PM (1 day ago)

3. Click Backup Now

4. SQLite Online Backup API runs (non-blocking — app stays usable)
   Progress: "Backing up..."

5. Complete:
     File: badachuli-backup-2081-05-08T14-32-00.sqlite
     Size: 2.4 MB
     Checksum: a3f8...
     "Backup successful!"
```

---

## Flow 12 — Restore from Backup

```
1. Settings → Backup & Restore → [Restore]

2. File picker → Select backup file: badachuli-backup-2081-05-07.sqlite

3. System validates:
   ✓ Checksum verified
   ✓ Schema version: 12 (compatible)
   Summary:
     Backup date: 2081-05-07 11:00 PM
     Bills: 847  |  Transactions: 4,201  |  File size: 2.3 MB

4. Warning dialog:
   "This will REPLACE the current database.
    A safety copy will be made first.
    Type RESTORE to confirm."

5. Operator types: RESTORE → Confirm

System:
  1. Safety copy: badachuli-pre-restore-2081-05-08.sqlite → same destination
  2. Replace live DB with backup file
  3. Reload DB connection
  4. Write audit_log: RESTORE_PERFORMED

6. App restarts → loads from restored data
```

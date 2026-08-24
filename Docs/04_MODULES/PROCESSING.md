# Module — Processing Engine

## 1. Purpose

The Processing module is the **core business operation** of the mill. The mill operates primarily as a **service provider** — customers walk in with their own raw materials, the mill processes them, and the customer takes the output back. The mill also processes its own inventory for resale (in-house). All processing rules — including yields, byproducts, and the fee structure — are fully configurable by the owner through the UI.

---

## 2. Two Processing Modes

| Mode | Who Owns Input Material? | Bill Generated? | Inventory Effect |
|---|---|---|---|
| **In-House Production** | The mill | No | Mill's raw material stock decreases; output/byproduct stock increases |
| **Customer Processing** | The customer | **Always yes** — bill is generated for every transaction. Grand total may be NRs 0 if charge is waived by byproduct offset. The printed bill also serves as a work-order authorization token the customer hands to the operator. | Only mill-retained byproducts enter the mill's inventory |

The mode is **explicitly set by the operator at the start of the operation** — never inferred from downstream state.

---

## 3. Variant Handling in Processing

**Input items have no variant for processing purposes.** Dhan is Dhan regardless of variety (Mansuli, Jeera, etc.). The processing rule applies uniformly. Variants only matter when the mill *sells* an item — because price differs by variety.

**Output items may optionally link to a variant.** When the mill processes its own Dhan for resale as Chamal, the operator may tag the output as a specific Chamal variant (e.g., Mansuli Chamal). For customer processing, the output variant is typically left unset — the customer knows what they brought.

This is already reflected in the schema: `processing_rules` has no `input_variant_id` column, and `processing_rule_outputs.output_variant_id` is nullable.

---

## 4. Items the Mill Processes

Based on the actual mill operations:

| Input Item | Primary Output | Key Byproducts | Notes |
|---|---|---|---|
| Dhan (paddy) | Chamal (milled rice) | Bhus (husk), Dhuto (bran) | Bhus kept by mill by default; Dhuto can offset the fee |
| Tori (mustard seeds) | Tori ko Tel (mustard oil) | Pina (oil cake) | Pina offsets the fee if left with mill |
| Makai (corn) | Makai products (flour/meal) | — | Always charged; no byproduct offset |
| Gahu (wheat) | Wheat flour | — | Always charged; no byproduct offset |
| Kodo (millet) | Millet products | — | Always charged; no byproduct offset |

**Items the mill sells from its own stock:**
- Chamal (milled rice varieties)
- Makai products
- Tori ko Tel (mustard oil)
- Dhuto (rice bran)
- Others (owner-configurable)

---

## 5. Byproduct-as-Payment System

This is the most domain-specific business rule in the system. Some byproducts are valuable enough that the customer leaving them with the mill offsets the processing fee entirely.

### 4.1 How It Works

When a processing rule output is configured as a **fee-offset byproduct**, the operator at transaction time chooses the disposition for that byproduct:

```
Option A: Customer leaves the byproduct with the mill
          → Processing charge is WAIVED (or reduced by the configured offset amount)
          → Byproduct goes into the mill's inventory

Option B: Customer takes the byproduct home
          → Processing charge is charged in full (cash/bank/udharo)
          → Byproduct does NOT enter the mill's inventory
```

### 4.2 Configured Examples

| Item | Byproduct | Default Disposition | Fee Offset If Left? |
|---|---|---|---|
| Dhan | Bhus (husk) | Mill keeps | No (Bhus is not worth enough to offset fee) |
| Dhan | Dhuto (bran) | Customer decides | YES — leaving Dhuto = free processing |
| Tori | Pina (oil cake) | Customer decides | YES — leaving Pina = free processing |
| Makai | — | — | No offset (always charged) |
| Gahu | — | — | No offset (always charged) |
| Kodo | — | — | No offset (always charged) |

### 4.3 Configuration Per Processing Rule Output

Each output line in a processing rule has two new flags:

```
default_disposition:   'mill_keeps' | 'customer_takes' | 'operator_decides'
waives_charge_if_left: true / false
charge_waiver_amount:  full | <numeric amount> | <percentage>
```

- `Bhus`: `default_disposition = 'mill_keeps'`, `waives_charge_if_left = false`
- `Dhuto`: `default_disposition = 'operator_decides'`, `waives_charge_if_left = true`, `charge_waiver_amount = 'full'`
- `Pina`: `default_disposition = 'operator_decides'`, `waives_charge_if_left = true`, `charge_waiver_amount = 'full'`

---

## 6. Functional Requirements

| ID | Requirement |
|---|---|
| FR-PROC-RULE-01 | Owner defines Processing Rules specifying input item, reference quantity, and one or more output items with quantities or percentages, byproducts, waste, and fee-offset configuration, with an effective date range. |
| FR-PROC-RULE-02 | Given an input quantity, the system calculates expected outputs by scaling the active rule. Ratios are variable and always owner-configurable — no ratios are hard-coded. |
| FR-PROC-RULE-03 | The operator can override calculated expected outputs with actual measured outputs; both values and the variance are stored. |
| FR-PROC-RULE-04 | For each `operator_decides` byproduct, the operator explicitly sets the disposition at transaction time (mill keeps / customer takes). |
| FR-PROC-RULE-05 | If a fee-offset byproduct is left with the mill, the processing charge is waived automatically — the system does not generate a charge line on the bill. |
| FR-PROC-TX-01 | Every processing transaction carries an explicit mode flag: `in_house` or `customer`. |
| FR-PROC-TX-02 | In-House mode: deduct mill's raw material stock, add outputs to mill's inventory, no bill. |
| FR-PROC-TX-03 | Customer Processing mode: record input (customer's material), resolve charge based on byproduct dispositions, **always generate a bill** (grand total may be NRs 0), print it as a work-order token for the operator, and update mill inventory for mill-retained outputs only. |
| FR-PROC-TX-04 | Full audit trail per transaction: input, rule, expected/actual outputs, dispositions, charge, operator, timestamp, linked bill. |

---

## 7. Processing Rule Structure

```
Rule: Dhan → Chamal
  Input:  Dhan (Paddy)  |  Reference qty: 100 kg
  
  Outputs:
  ┌────────────────┬────────┬────────────────────────┬───────────────────────┐
  │ Output         │ Qty    │ Default Disposition    │ Waives Charge if Left │
  ├────────────────┼────────┼────────────────────────┼───────────────────────┤
  │ Chamal         │ 65 kg  │ Customer takes         │ —                     │
  │ Bhus (husk)    │ 25 kg  │ Mill keeps             │ No                    │
  │ Dhuto (bran)   │  8 kg  │ Operator decides       │ YES (full waiver)     │
  │ Loss (waste)   │  2 kg  │ —                      │ —                     │
  └────────────────┴────────┴────────────────────────┴───────────────────────┘
  
  Processing charge (if Dhuto taken): configurable per kg rate (e.g., NRs 3.00/kg)
  Processing charge (if Dhuto left):  NRs 0.00 (waived)
  Effective from: 2081-01-01  |  Active: Yes
```

```
Rule: Tori → Tel
  Input:  Tori (Mustard Seeds)  |  Reference qty: 100 kg
  
  Outputs:
  ┌────────────────┬────────┬────────────────────────┬───────────────────────┐
  │ Output         │ Qty    │ Default Disposition    │ Waives Charge if Left │
  ├────────────────┼────────┼────────────────────────┼───────────────────────┤
  │ Tori ko Tel    │ 35 kg  │ Customer takes         │ —                     │
  │ Pina (cake)    │ 62 kg  │ Operator decides       │ YES (full waiver)     │
  │ Loss           │  3 kg  │ —                      │ —                     │
  └────────────────┴────────┴────────────────────────┴───────────────────────┘
  
  Processing charge (if Pina taken):  configurable per kg rate
  Processing charge (if Pina left):   NRs 0.00 (waived)
```

**Rule versioning:** When ratios change (machine upgrade, seasonal variance), the owner creates a new rule with a new `effective_from` date. The old rule is not edited. Historical transactions always reference the exact rule version that was active at the time.

---

## 8. Expected Output Calculation (Domain Layer)

```typescript
// domain/processing-engine.ts

interface ResolvedOutput {
  itemId: number;
  variantId: number | null;
  expectedQty: number;
  isWaste: boolean;
  isByproduct: boolean;
  defaultDisposition: 'mill_keeps' | 'customer_takes' | 'operator_decides';
  waivesChargeIfLeft: boolean;
}

function calculateExpectedOutputs(
  rule: ProcessingRule,
  outputs: ProcessingRuleOutput[],
  inputQty: number
): ResolvedOutput[] {
  const scale = inputQty / rule.reference_qty;
  return outputs.map(o => ({
    itemId:              o.output_item_id,
    variantId:           o.output_variant_id,
    expectedQty:         o.is_percentage
                           ? (o.qty_or_pct / 100) * inputQty
                           : o.qty_or_pct * scale,
    isWaste:             o.is_waste === 1,
    isByproduct:         o.is_byproduct === 1,
    defaultDisposition:  o.default_disposition,
    waivesChargeIfLeft:  o.waives_charge_if_left === 1,
  }));
}

function resolveProcessingCharge(
  baseCharge: number,
  outputs: ResolvedOutput[],
  dispositions: Record<number, 'mill_keeps' | 'customer_takes'>
): number {
  // If any fee-offset byproduct is left with the mill, charge is waived
  const chargeWaived = outputs.some(
    o => o.waivesChargeIfLeft && dispositions[o.itemId] === 'mill_keeps'
  );
  return chargeWaived ? 0 : baseCharge;
}
```

Both functions are **pure** — no I/O, no DB calls. Fully unit-testable.

---

## 9. Customer Processing Flow

```
Processing → New Transaction → Customer Processing
    │
    ├── Select customer (or create inline)
    ├── Select rule: e.g., "Dhan → Chamal"
    ├── Enter input quantity: 500 kg Dhan
    │
    ▼
Expected outputs auto-calculated and displayed:
  Chamal:   325 kg  → Customer takes home  [fixed]
  Bhus:     125 kg  → Mill keeps           [fixed - greyed out]
  Dhuto:     40 kg  → [ Mill keeps ] OR [ Customer takes ]  ← operator chooses
  Waste:     10 kg  → (recorded, not in inventory)
    │
    ▼
Operator selects Dhuto disposition:
  [✓ Mill keeps Dhuto]  → Processing charge: NRs 0.00 (FREE)
  [ Customer takes Dhuto] → Processing charge: NRs 1,500 (500 kg × 3.00/kg)
    │
    ▼
Operator enters actual measured outputs:
  Chamal:  324 kg  (expected 325, variance -1)
  Bhus:    126 kg  (expected 125, variance +1)
  Dhuto:    39 kg  (expected 40,  variance -1)
    │
    ▼
Confirm
    │
    ▼
Service layer (single DB transaction):
  1. INSERT processing_transactions (mode='customer', dispositions_json, charge=0 or X)
  2. INSERT inventory_transactions: Bhus +126 kg (mill_keeps → byproduct stock)
  3. INSERT inventory_transactions: Dhuto +39 kg (if mill_keeps → byproduct stock)
  4. INSERT bill + bill_lines ALWAYS (grand_total = 0 if charge waived, else processing rate × qty)
  5. Print bill immediately — customer takes the printed bill to the operator as a work-order
  6. audit_log: PROCESSING_COMPLETED
```

---

## 10. In-House Processing Flow

```
Processing → New Transaction → In-House
    │
    ├── Select rule
    ├── Enter input quantity
    ├── Expected outputs shown (dispositions all default to mill's inventory)
    ├── Enter actual outputs
    └── Notes → Confirm
    │
    ▼
Service layer (single DB transaction):
  1. Negative stock guard: mill's raw_material stock ≥ input_qty
  2. INSERT processing_transactions (mode='in_house')
  3. INSERT inventory_transactions: input item -qty (raw_material, processed_out)
  4. For each non-waste actual output:
       INSERT inventory_transactions: output item +qty (finished or byproduct, processed_in)
  5. audit_log: PROCESSING_COMPLETED
```

---

## 11. Updated Data Model for Processing Rule Outputs

The `processing_rule_outputs` table gains three columns beyond the original schema:

```sql
CREATE TABLE processing_rule_outputs (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id               INTEGER NOT NULL REFERENCES processing_rules(id),
  output_item_id        INTEGER NOT NULL REFERENCES items(id),
  output_variant_id     INTEGER          REFERENCES variants(id),
  qty_or_pct            NUMERIC NOT NULL,
  is_percentage         INTEGER NOT NULL DEFAULT 0,
  is_waste              INTEGER NOT NULL DEFAULT 0,
  is_byproduct          INTEGER NOT NULL DEFAULT 0,

  -- Byproduct disposition configuration
  default_disposition   TEXT    NOT NULL DEFAULT 'customer_takes'
                        CHECK (default_disposition IN (
                          'mill_keeps',       -- always stays with mill (e.g., Bhus)
                          'customer_takes',   -- always goes to customer (e.g., Chamal, Tel)
                          'operator_decides'  -- operator chooses at transaction time (e.g., Dhuto, Pina)
                        )),
  waives_charge_if_left INTEGER NOT NULL DEFAULT 0,  -- 1 = leaving this with mill = free processing

  sort_order            INTEGER NOT NULL DEFAULT 0
);
```

The `processing_transactions` table gains a `dispositions_json` column:

```sql
-- Added to processing_transactions:
dispositions_json TEXT NOT NULL DEFAULT '{}',
-- Format: { "output_item_id": "mill_keeps" | "customer_takes", ... }
-- Only populated for 'operator_decides' outputs
```

---

## 11. Byproduct Inventory from Customer Processing

When a customer leaves a byproduct with the mill, the quantity added to the mill's inventory is **estimated from the rule ratio** — the byproduct is not separately weighed at the counter.

```
Example: Customer brings 20 kg Tori
Rule: 100 kg Tori → 35 kg Tel + 62 kg Pina + 3 kg loss

Estimated Pina = 20 × (62/100) = 12.4 kg → rounded to 12 kg

inventory_transactions row: Pina +12 kg (byproduct category)
```

The owner configures the ratio in the processing rule. If the actual yield is consistently different, the owner updates the rule ratio — not each individual transaction.

The zero-charge processing bill receipt shows:

```
════════════════════════════════════════
        BADACHULI RICE MILL
        Kohalpur, Banke  |  PAN: XXXXXXX
════════════════════════════════════════
PROCESSING RECEIPT
Bill No:  BRM-2081-00143   Date: 2081-05-12
Customer: Ram Bahadur Thapa
════════════════════════════════════════
Item              Qty      Processing Fee
────────────────────────────────────────
Tori Processing   20 kg    NRs 0.00
                           (Pina retained)
────────────────────────────────────────
Total:            NRs 0.00
Payment:          Byproduct Offset
                  Pina ~12 kg retained by mill
════════════════════════════════════════
*** WORK ORDER — Show to Operator ***
  BRM-2081-00143
Please present this receipt to begin processing.
════════════════════════════════════════
```

The "WORK ORDER — Show to Operator" section is what the customer carries to the machine operator. It contains the bill number so the operator can verify it in the system if needed.

---

## 13. Yield Report Data

```
Per processing transaction:
  - Mode (in_house / customer)
  - Input item, quantity
  - Rule used (name + version)
  - Per output: expected qty, actual qty, variance, disposition
  - Processing charge (NRs 0 if waived; actual charge otherwise)
  - Waiver applied? (bool — useful for counting "free" vs. "paid" batches)
  - Operator, date
```

The Processing Report can answer: "How much Dhuto did we collect this month from customer processing?" and "What % of Dhan customers left Dhuto with us vs. took it?"

---

## 14. Business Rules

1. **Mode is immutable after save.**
2. **The active rule at transaction time is referenced.** Owner can freely update rules; history is unaffected.
3. **Actual outputs drive inventory, not expected outputs.**
4. **Charge resolution is deterministic.** Given the dispositions chosen by the operator, the charge is either 0 (waiver applied) or the configured rate. There is no ambiguous middle state.
5. **A bill is always generated for customer processing.** Even when the processing charge is waived (grand_total = NRs 0), a bill is printed and handed to the customer. This printed bill is the work-order authorization — the operator only processes the customer's grain after seeing the bill. `processing_transactions.bill_id` is never NULL for customer processing transactions.
6. **All byproducts the mill retains enter inventory.** Whether a byproduct defaults to 'mill_keeps' or the operator chose 'mill_keeps' at transaction time, the actual quantity goes into the appropriate stock category via `inventory_transactions`.
7. **Processing transactions cannot be hard-deleted.**
8. **Ratios are always owner-configurable.** No yield percentage or quantity is hard-coded in application code.

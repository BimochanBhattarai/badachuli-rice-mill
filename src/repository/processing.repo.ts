import Database from 'better-sqlite3'

export interface ProcessingRuleRow {
  id: number
  name: string
  input_item_id: number
  input_variant_id: number | null
  input_unit_id: number
  is_active: number
  notes: string | null
  created_at: string
}

export interface ProcessingRuleOutputRow {
  id: number
  rule_id: number
  output_item_id: number
  output_variant_id: number | null
  output_unit_id: number
  yield_pct: number
  sort_order: number
}

export interface RuleOutputDetail extends ProcessingRuleOutputRow {
  output_item_name: string
  output_variant_name: string | null
  output_unit_abbreviation: string
}

export interface ProcessingRuleWithDetail extends ProcessingRuleRow {
  input_item_name: string
  input_variant_name: string | null
  input_unit_abbreviation: string
  outputs: RuleOutputDetail[]
}

export interface BatchOutputInput {
  outputItemId: number
  outputVariantId: number | null
  outputUnitId: number
  expectedQty: number
  actualQty: number
}

export interface RunBatchInput {
  ruleId: number
  inputItemId: number
  inputVariantId: number | null
  inputUnitId: number
  inputQty: number
  batchType: 'in_house' | 'customer'
  customerId: number | null
  outputs: BatchOutputInput[]
  notes?: string
  operatorId: number
}

export function getAllRules(db: Database.Database): ProcessingRuleWithDetail[] {
  const rules = db.prepare(
    `SELECT r.*,
       i.name  as input_item_name,
       v.name  as input_variant_name,
       u.abbreviation as input_unit_abbreviation
     FROM processing_rules r
     JOIN items i ON i.id = r.input_item_id
     LEFT JOIN variants v ON v.id = r.input_variant_id
     JOIN units u ON u.id = r.input_unit_id
     WHERE r.is_active = 1
     ORDER BY r.name`
  ).all() as (ProcessingRuleRow & { input_item_name: string; input_variant_name: string | null; input_unit_abbreviation: string })[]

  const outputStmt = db.prepare(
    `SELECT ro.*,
       i.name  as output_item_name,
       v.name  as output_variant_name,
       u.abbreviation as output_unit_abbreviation
     FROM processing_rule_outputs ro
     JOIN items i ON i.id = ro.output_item_id
     LEFT JOIN variants v ON v.id = ro.output_variant_id
     JOIN units u ON u.id = ro.output_unit_id
     WHERE ro.rule_id = ?
     ORDER BY ro.sort_order`
  )

  return rules.map(r => ({
    ...r,
    outputs: outputStmt.all(r.id) as RuleOutputDetail[],
  }))
}

export function createRule(
  db: Database.Database,
  name: string,
  inputItemId: number,
  inputVariantId: number | null,
  inputUnitId: number,
  outputs: { outputItemId: number; outputVariantId: number | null; outputUnitId: number; yieldPct: number }[],
  notes?: string
): number {
  return db.transaction(() => {
    if (!outputs.length) throw new Error('A rule must have at least one output')

    const res = db.prepare(
      `INSERT INTO processing_rules (name, input_item_id, input_variant_id, input_unit_id, notes)
       VALUES (?, ?, ?, ?, ?)`
    ).run(name, inputItemId, inputVariantId, inputUnitId, notes ?? null)
    const ruleId = res.lastInsertRowid as number

    const outStmt = db.prepare(
      `INSERT INTO processing_rule_outputs
         (rule_id, output_item_id, output_variant_id, output_unit_id, yield_pct, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    outputs.forEach((o, i) => {
      outStmt.run(ruleId, o.outputItemId, o.outputVariantId, o.outputUnitId, o.yieldPct, i)
    })

    return ruleId
  })()
}

export function deactivateRule(db: Database.Database, id: number): void {
  db.prepare('UPDATE processing_rules SET is_active = 0 WHERE id = ?').run(id)
}

// Returns category string for inventory_transactions based on item flags
function itemCategory(
  db: Database.Database,
  itemId: number
): 'raw_material' | 'finished' | 'byproduct' | 'consumable' {
  const item = db.prepare('SELECT is_buyable, is_sellable, is_processable FROM items WHERE id = ?').get(itemId) as
    { is_buyable: number; is_sellable: number; is_processable: number } | undefined
  if (!item) return 'raw_material'
  if (item.is_buyable && item.is_processable) return 'raw_material'
  if (item.is_sellable && !item.is_buyable) return 'finished'
  if (item.is_buyable && !item.is_processable) return 'consumable'
  return 'byproduct'
}

export function runBatch(db: Database.Database, input: RunBatchInput): { batchId: number } {
  return db.transaction(() => {
    const batchRes = db.prepare(
      `INSERT INTO processing_batches
         (rule_id, input_item_id, input_variant_id, input_unit_id, input_qty,
          batch_type, customer_id, notes, operator_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.ruleId, input.inputItemId, input.inputVariantId, input.inputUnitId,
      input.inputQty, input.batchType, input.customerId ?? null,
      input.notes ?? null, input.operatorId
    )
    const batchId = batchRes.lastInsertRowid as number

    // Deduct input from inventory
    const inputCat = itemCategory(db, input.inputItemId)
    db.prepare(
      `INSERT INTO inventory_transactions
         (item_id, variant_id, unit_id, qty_delta, category, tx_type,
          reference_id, reference_type, operator_id)
       VALUES (?, ?, ?, ?, ?, 'processing_in', ?, 'batch', ?)`
    ).run(
      input.inputItemId, input.inputVariantId, input.inputUnitId,
      -input.inputQty, inputCat, batchId, input.operatorId
    )

    const outStmt = db.prepare(
      `INSERT INTO processing_batch_outputs
         (batch_id, output_item_id, output_variant_id, output_unit_id, expected_qty, actual_qty)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    const invStmt = db.prepare(
      `INSERT INTO inventory_transactions
         (item_id, variant_id, unit_id, qty_delta, category, tx_type,
          reference_id, reference_type, operator_id)
       VALUES (?, ?, ?, ?, ?, 'processing_out', ?, 'batch', ?)`
    )

    for (const o of input.outputs) {
      outStmt.run(batchId, o.outputItemId, o.outputVariantId, o.outputUnitId, o.expectedQty, o.actualQty)
      const outCat = itemCategory(db, o.outputItemId)
      invStmt.run(
        o.outputItemId, o.outputVariantId, o.outputUnitId,
        o.actualQty, outCat, batchId, input.operatorId
      )
    }

    return { batchId }
  })()
}

export interface BatchWithRule {
  id: number
  rule_name: string
  input_item_name: string
  input_variant_name: string | null
  input_unit_abbreviation: string
  input_qty: number
  batch_type: string
  customer_name: string | null
  operator_id: number
  created_at: string
}

export function getRecentBatches(db: Database.Database, limit = 30): BatchWithRule[] {
  return db.prepare(
    `SELECT pb.id, r.name as rule_name,
       i.name  as input_item_name,
       v.name  as input_variant_name,
       u.abbreviation as input_unit_abbreviation,
       pb.input_qty, pb.batch_type,
       c.name as customer_name,
       pb.operator_id, pb.created_at
     FROM processing_batches pb
     JOIN processing_rules r ON r.id = pb.rule_id
     JOIN items i ON i.id = pb.input_item_id
     LEFT JOIN variants v ON v.id = pb.input_variant_id
     JOIN units u ON u.id = pb.input_unit_id
     LEFT JOIN customers c ON c.id = pb.customer_id
     ORDER BY pb.created_at DESC
     LIMIT ?`
  ).all(limit) as BatchWithRule[]
}

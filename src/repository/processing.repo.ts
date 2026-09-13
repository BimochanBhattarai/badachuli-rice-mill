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
     LEFT JOIN units u ON u.id = COALESCE(r.input_unit_id, r.reference_unit_id)
     WHERE r.is_active = 1 AND r.is_adhoc = 0
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

function itemCategory(
  db: Database.Database,
  itemId: number
): 'raw_material' | 'finished' | 'byproduct' {
  const item = db.prepare('SELECT is_sellable FROM items WHERE id = ?').get(itemId) as
    { is_sellable: number } | undefined
  if (item?.is_sellable) return 'finished'
  return 'raw_material'
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

export interface AdHocOutput {
  outputItemId: number
  outputVariantId: number | null
  outputUnitId: number
  yieldPct: number
  actualQty: number
}

export interface RunAdHocInput {
  inputItemId: number
  inputVariantId: number | null
  inputUnitId: number
  inputQty: number
  outputs: AdHocOutput[]
  notes?: string
  operatorId: number
}

export function runAdHocBatch(db: Database.Database, input: RunAdHocInput): { batchId: number } {
  return db.transaction(() => {
    if (!input.outputs.length) throw new Error('At least one output is required')
    if (input.inputQty <= 0) throw new Error('Input quantity must be greater than 0')

    const inputItem = db.prepare('SELECT name FROM items WHERE id = ?').get(input.inputItemId) as { name: string } | undefined
    const ruleName = `[मिल] ${inputItem?.name ?? 'Ad-hoc'} — ${new Date().toISOString()}`
    const ruleRes = db.prepare(
      `INSERT INTO processing_rules (name, input_item_id, input_variant_id, input_unit_id, is_adhoc)
       VALUES (?, ?, ?, ?, 1)`
    ).run(ruleName, input.inputItemId, input.inputVariantId, input.inputUnitId)
    const ruleId = ruleRes.lastInsertRowid as number

    const outStmt = db.prepare(
      `INSERT INTO processing_rule_outputs
         (rule_id, output_item_id, output_variant_id, output_unit_id, yield_pct, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    input.outputs.forEach((o, i) => {
      outStmt.run(ruleId, o.outputItemId, o.outputVariantId, o.outputUnitId, o.yieldPct, i)
    })

    const batchRes = db.prepare(
      `INSERT INTO processing_batches
         (rule_id, input_item_id, input_variant_id, input_unit_id, input_qty,
          batch_type, customer_id, notes, operator_id)
       VALUES (?, ?, ?, ?, ?, 'in_house', NULL, ?, ?)`
    ).run(ruleId, input.inputItemId, input.inputVariantId, input.inputUnitId,
      input.inputQty, input.notes ?? null, input.operatorId)
    const batchId = batchRes.lastInsertRowid as number

    const inputCat = itemCategory(db, input.inputItemId)
    db.prepare(
      `INSERT INTO inventory_transactions
         (item_id, variant_id, unit_id, qty_delta, category, tx_type,
          reference_id, reference_type, operator_id)
       VALUES (?, ?, ?, ?, ?, 'processing_in', ?, 'batch', ?)`
    ).run(input.inputItemId, input.inputVariantId, input.inputUnitId,
      -input.inputQty, inputCat, batchId, input.operatorId)

    const outBatchStmt = db.prepare(
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
      const expected = (input.inputQty * o.yieldPct) / 100
      outBatchStmt.run(batchId, o.outputItemId, o.outputVariantId, o.outputUnitId, expected, o.actualQty)
      const outCat = itemCategory(db, o.outputItemId)
      invStmt.run(o.outputItemId, o.outputVariantId, o.outputUnitId, o.actualQty, outCat, batchId, input.operatorId)
    }

    return { batchId }
  })()
}

export function getRecentMillBatches(db: Database.Database, limit = 30): BatchWithRule[] {
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
     WHERE r.is_adhoc = 1
     ORDER BY pb.created_at DESC
     LIMIT ?`
  ).all(limit) as BatchWithRule[]
}

export interface MillPreset {
  id: number
  output_item_id: number
  output_item_name: string
  output_unit_id: number
  output_unit_abbreviation: string
  default_yield_pct: number
  is_byproduct: number
  sort_order: number
}

export function getPresetsForItem(db: Database.Database, inputItemId: number): MillPreset[] {
  return db.prepare(
    `SELECT mpp.id, mpp.output_item_id,
       i.name as output_item_name,
       mpp.output_unit_id,
       u.abbreviation as output_unit_abbreviation,
       mpp.default_yield_pct, mpp.is_byproduct, mpp.sort_order
     FROM mill_processing_presets mpp
     JOIN items i ON i.id = mpp.output_item_id
     JOIN units u ON u.id = mpp.output_unit_id
     WHERE mpp.input_item_id = ?
     ORDER BY mpp.sort_order`
  ).all(inputItemId) as MillPreset[]
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

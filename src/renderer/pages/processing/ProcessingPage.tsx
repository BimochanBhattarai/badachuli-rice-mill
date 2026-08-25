import { useEffect, useRef, useState } from 'react'
import type {
  AuthUser, ItemRow, VariantRow, UnitRow,
  ProcessingRuleWithDetail, ProcessingRuleOutputRow,
  BatchWithRule, BatchOutputInput,
} from '../../../shared/types/api'

interface Props { currentUser: AuthUser }

type View = 'rules' | 'new-rule' | 'run'

// ── Draft output line while building a new rule ──────────────
interface DraftOutput {
  item: ItemRow
  variants: VariantRow[]
  units: UnitRow[]
  variantId: string
  unitId: string
  yieldPct: string
}

// ── Editable output line during a batch run ───────────────────
interface RunOutput extends BatchOutputInput {
  label: string
  unitAbbr: string
  actualQtyStr: string
}

export default function ProcessingPage({ currentUser }: Props) {
  const [view, setView] = useState<View>('rules')
  const [rules, setRules] = useState<ProcessingRuleWithDetail[]>([])
  const [batches, setBatches] = useState<BatchWithRule[]>([])
  const [activeRule, setActiveRule] = useState<ProcessingRuleWithDetail | null>(null)

  // ── New-rule form state ───────────────────────────────────────
  const [ruleName, setRuleName] = useState('')
  const [ruleNotes, setRuleNotes] = useState('')
  const [inputItem, setInputItem] = useState<ItemRow | null>(null)
  const [inputItemSearch, setInputItemSearch] = useState('')
  const [inputItemResults, setInputItemResults] = useState<ItemRow[]>([])
  const [showInputDrop, setShowInputDrop] = useState(false)
  const [inputVariants, setInputVariants] = useState<VariantRow[]>([])
  const [inputUnits, setInputUnits] = useState<UnitRow[]>([])
  const [inputVariantId, setInputVariantId] = useState('')
  const [inputUnitId, setInputUnitId] = useState('')
  const [draftOutputs, setDraftOutputs] = useState<DraftOutput[]>([])
  // Output picker state
  const [outSearch, setOutSearch] = useState('')
  const [outResults, setOutResults] = useState<ItemRow[]>([])
  const [showOutDrop, setShowOutDrop] = useState(false)

  // ── Run batch state ───────────────────────────────────────────
  const [runQty, setRunQty] = useState('')
  const [runOutputs, setRunOutputs] = useState<RunOutput[]>([])
  const [runNotes, setRunNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const outSearchRef = useRef<HTMLInputElement>(null)

  async function loadRules() {
    const res = await window.api.processing.getRules()
    if (res.ok && res.data) setRules(res.data)
  }
  async function loadBatches() {
    const res = await window.api.processing.getRecentBatches(30)
    if (res.ok && res.data) setBatches(res.data)
  }

  useEffect(() => { loadRules(); loadBatches() }, [])

  // ── Input item search ─────────────────────────────────────────
  useEffect(() => {
    if (!inputItemSearch.trim()) { setInputItemResults([]); return }
    window.api.items.search(inputItemSearch, { processable: true }).then(r => {
      if (r.ok && r.data) { setInputItemResults(r.data); setShowInputDrop(true) }
    })
  }, [inputItemSearch])

  async function selectInputItem(item: ItemRow) {
    setInputItem(item)
    setInputItemSearch(item.name)
    setShowInputDrop(false)
    const [vRes, uRes] = await Promise.all([
      window.api.variants.getByItem(item.id),
      window.api.units.getAll(),
    ])
    const variants = (vRes.data ?? []).filter(v => v.is_active)
    const units = uRes.data ?? []
    const defVariant = variants.find(v => v.is_default) ?? variants[0]
    const defUnit = units.find(u => u.id === item.default_unit_id) ?? units.find(u => u.is_default) ?? units[0]
    setInputVariants(variants)
    setInputUnits(units)
    setInputVariantId(defVariant ? String(defVariant.id) : '')
    setInputUnitId(defUnit ? String(defUnit.id) : '')
  }

  // ── Output item search ────────────────────────────────────────
  useEffect(() => {
    if (!outSearch.trim()) { setOutResults([]); setShowOutDrop(false); return }
    window.api.items.search(outSearch).then(r => {
      if (r.ok && r.data) { setOutResults(r.data); setShowOutDrop(true) }
    })
  }, [outSearch])

  async function selectOutputItem(item: ItemRow) {
    setOutSearch('')
    setShowOutDrop(false)
    const [vRes, uRes] = await Promise.all([
      window.api.variants.getByItem(item.id),
      window.api.units.getAll(),
    ])
    const variants = (vRes.data ?? []).filter(v => v.is_active)
    const units = uRes.data ?? []
    const defVariant = variants.find(v => v.is_default) ?? variants[0]
    const defUnit = units.find(u => u.id === item.default_unit_id) ?? units.find(u => u.is_default) ?? units[0]
    setDraftOutputs(prev => [...prev, {
      item,
      variants,
      units,
      variantId: defVariant ? String(defVariant.id) : '',
      unitId: defUnit ? String(defUnit.id) : '',
      yieldPct: '',
    }])
    outSearchRef.current?.focus()
  }

  function removeDraftOutput(idx: number) {
    setDraftOutputs(prev => prev.filter((_, i) => i !== idx))
  }

  function resetNewRuleForm() {
    setRuleName(''); setRuleNotes(''); setInputItem(null); setInputItemSearch('')
    setInputVariants([]); setInputUnits([]); setInputVariantId(''); setInputUnitId('')
    setDraftOutputs([]); setError('')
  }

  async function saveRule() {
    setError('')
    if (!ruleName.trim()) { setError('Rule name is required'); return }
    if (!inputItem) { setError('Select an input item'); return }
    if (!inputUnitId) { setError('Select input unit'); return }
    const outputs = draftOutputs.map(o => ({
      outputItemId: o.item.id,
      outputVariantId: o.variantId ? parseInt(o.variantId) : null,
      outputUnitId: parseInt(o.unitId),
      yieldPct: parseFloat(o.yieldPct),
    }))
    if (!outputs.length) { setError('Add at least one output'); return }
    const bad = outputs.find(o => isNaN(o.yieldPct) || o.yieldPct <= 0)
    if (bad) { setError('All outputs need a valid yield %'); return }

    setSaving(true)
    try {
      const res = await window.api.processing.createRule(
        ruleName,
        inputItem.id,
        inputVariantId ? parseInt(inputVariantId) : null,
        parseInt(inputUnitId),
        outputs,
        ruleNotes || undefined
      )
      if (!res.ok) { setError(res.error ?? 'Error'); return }
      resetNewRuleForm()
      setView('rules')
      loadRules()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setSaving(false)
    }
  }

  // ── Run batch ─────────────────────────────────────────────────
  function openRun(rule: ProcessingRuleWithDetail) {
    setActiveRule(rule)
    setRunQty('')
    setRunNotes('')
    setRunOutputs(rule.outputs.map(o => ({
      outputItemId: o.output_item_id,
      outputVariantId: o.output_variant_id,
      outputUnitId: o.output_unit_id,
      expectedQty: 0,
      actualQty: 0,
      label: makeLabel(o),
      unitAbbr: o.output_unit_abbreviation,
      actualQtyStr: '',
    })))
    setError('')
    setSuccessMsg('')
    setView('run')
  }

  function makeLabel(o: ProcessingRuleOutputRow) {
    return o.output_variant_name && o.output_variant_name !== o.output_item_name
      ? `${o.output_item_name} · ${o.output_variant_name}`
      : o.output_item_name
  }

  function onRunQtyChange(val: string) {
    setRunQty(val)
    const qty = parseFloat(val)
    if (!activeRule || isNaN(qty) || qty <= 0) return
    setRunOutputs(prev => prev.map((o, i) => {
      const expected = (qty * activeRule.outputs[i].yield_pct) / 100
      return { ...o, expectedQty: expected, actualQty: expected, actualQtyStr: expected.toFixed(2) }
    }))
  }

  function onActualQtyChange(idx: number, val: string) {
    setRunOutputs(prev => prev.map((o, i) =>
      i === idx ? { ...o, actualQtyStr: val, actualQty: parseFloat(val) || 0 } : o
    ))
  }

  async function saveBatch() {
    setError('')
    if (!activeRule) return
    const qty = parseFloat(runQty)
    if (isNaN(qty) || qty <= 0) { setError('Enter a valid input quantity'); return }
    const badOutput = runOutputs.find(o => isNaN(o.actualQty) || o.actualQty < 0)
    if (badOutput) { setError(`Invalid actual qty for ${badOutput.label}`); return }

    setSaving(true)
    try {
      const res = await window.api.processing.runBatch({
        ruleId: activeRule.id,
        inputItemId: activeRule.input_item_id,
        inputVariantId: activeRule.input_variant_id,
        inputUnitId: activeRule.input_unit_id,
        inputQty: qty,
        batchType: 'in_house',
        customerId: null,
        outputs: runOutputs.map(o => ({
          outputItemId: o.outputItemId,
          outputVariantId: o.outputVariantId,
          outputUnitId: o.outputUnitId,
          expectedQty: o.expectedQty,
          actualQty: o.actualQty,
        })),
        notes: runNotes || undefined,
        operatorId: currentUser.id,
      })
      if (!res.ok) { setError(res.error ?? 'Error'); return }
      setSuccessMsg(`Batch #${res.data!.batchId} recorded`)
      setRunQty('')
      setRunNotes('')
      loadBatches()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IPC error — restart the app')
    } finally {
      setSaving(false)
    }
  }

  function fmtDate(s: string) {
    return new Date(s).toLocaleDateString('en-NP', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="catalog-page">
      {/* Header tabs */}
      <div className="catalog-header">
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn-ghost${view === 'rules' ? ' nav-btn-active' : ''}`}
            onClick={() => { setView('rules'); setError(''); setSuccessMsg('') }}
          >
            Rules &amp; History
          </button>
          <button
            className={`btn-ghost${view === 'new-rule' ? ' nav-btn-active' : ''}`}
            onClick={() => { setView('new-rule'); setError('') }}
          >
            + New Rule
          </button>
          {view === 'run' && activeRule && (
            <span className="nav-btn nav-btn-active">
              Run: {activeRule.name}
            </span>
          )}
        </div>
      </div>

      {/* ── Rules + History view ───────────────────────────────── */}
      {view === 'rules' && (
        <>
          <h3 style={{ marginBottom: '0.5rem', color: '#9ca3af', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Processing Rules
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Input</th>
                <th>Outputs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 && (
                <tr><td colSpan={4} className="empty-state">No rules yet — create one to start processing</td></tr>
              )}
              {rules.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>
                    {r.input_item_name}
                    {r.input_variant_name && r.input_variant_name !== r.input_item_name && (
                      <span className="text-muted"> · {r.input_variant_name}</span>
                    )}
                    <span className="text-muted"> / {r.input_unit_abbreviation}</span>
                  </td>
                  <td>
                    {r.outputs.map(o => (
                      <span key={o.id} className="purpose-tag" style={{ marginRight: '0.25rem' }}>
                        {makeLabel(o)} {o.yield_pct}%
                      </span>
                    ))}
                  </td>
                  <td className="row-actions">
                    <button className="btn-primary btn-sm" onClick={() => openRun(r)}>Run</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ margin: '1.5rem 0 0.5rem', color: '#9ca3af', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent Batches
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Rule</th>
                <th>Input</th>
                <th>Qty</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 && (
                <tr><td colSpan={5} className="empty-state">No batches recorded yet</td></tr>
              )}
              {batches.map(b => (
                <tr key={b.id}>
                  <td className="text-muted">{fmtDate(b.created_at)}</td>
                  <td style={{ fontWeight: 600 }}>{b.rule_name}</td>
                  <td>
                    {b.input_item_name}
                    {b.input_variant_name && b.input_variant_name !== b.input_item_name && (
                      <span className="text-muted"> · {b.input_variant_name}</span>
                    )}
                  </td>
                  <td>{b.input_qty} {b.input_unit_abbreviation}</td>
                  <td>
                    <span className="purpose-tag">
                      {b.batch_type === 'in_house' ? 'In-house' : `Customer: ${b.customer_name ?? '—'}`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── New Rule form ──────────────────────────────────────── */}
      {view === 'new-rule' && (
        <div className="inline-form">
          <h3>New Processing Rule</h3>
          {error && <p className="form-error">{error}</p>}

          <div className="form-row">
            <label>
              Rule name
              <input
                type="text" value={ruleName} required autoFocus
                placeholder="e.g. Sabitri Milling"
                onChange={e => setRuleName(e.target.value)}
              />
            </label>
            <label>
              Notes (optional)
              <input
                type="text" value={ruleNotes}
                placeholder="Any notes about this rule"
                onChange={e => setRuleNotes(e.target.value)}
              />
            </label>
          </div>

          <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0.75rem 0 0.25rem' }}>Input</p>
          <div className="form-row" style={{ alignItems: 'flex-start' }}>
            <label>
              Item (processable)
              <div style={{ position: 'relative' }}>
                <input
                  type="text" value={inputItemSearch}
                  placeholder="Search processable item…"
                  onChange={e => setInputItemSearch(e.target.value)}
                  onFocus={() => inputItemResults.length > 0 && setShowInputDrop(true)}
                  onBlur={() => setTimeout(() => setShowInputDrop(false), 150)}
                />
                {showInputDrop && inputItemResults.length > 0 && (
                  <ul className="dropdown-list">
                    {inputItemResults.map(i => (
                      <li key={i.id} onMouseDown={() => selectInputItem(i)}>
                        <span>{i.name}</span>
                        <span className="text-muted">{i.unit_abbreviation}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </label>
            {inputItem && inputVariants.length > 1 && (
              <label>
                Variant
                <select value={inputVariantId} onChange={e => setInputVariantId(e.target.value)}>
                  {inputVariants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </label>
            )}
            {inputItem && (
              <label>
                Unit
                <select value={inputUnitId} onChange={e => setInputUnitId(e.target.value)}>
                  {inputUnits.map(u => <option key={u.id} value={u.id}>{u.abbreviation}</option>)}
                </select>
              </label>
            )}
          </div>

          <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0.75rem 0 0.25rem' }}>Outputs</p>

          {draftOutputs.length > 0 && (
            <table className="data-table" style={{ marginBottom: '0.5rem' }}>
              <thead>
                <tr><th>Output item</th><th>Variant</th><th>Unit</th><th>Yield %</th><th></th></tr>
              </thead>
              <tbody>
                {draftOutputs.map((o, i) => (
                  <tr key={i}>
                    <td>{o.item.name}</td>
                    <td>
                      {o.variants.length > 1 ? (
                        <select value={o.variantId} onChange={e =>
                          setDraftOutputs(prev => prev.map((x, j) => j === i ? { ...x, variantId: e.target.value } : x))
                        }>
                          {o.variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-muted">{o.variants[0]?.name ?? '—'}</span>
                      )}
                    </td>
                    <td>
                      <select value={o.unitId} onChange={e =>
                        setDraftOutputs(prev => prev.map((x, j) => j === i ? { ...x, unitId: e.target.value } : x))
                      }>
                        {o.units.map(u => <option key={u.id} value={u.id}>{u.abbreviation}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number" step="0.01" min="0.01" max="100"
                        value={o.yieldPct} placeholder="%"
                        style={{ width: '80px' }}
                        onChange={e =>
                          setDraftOutputs(prev => prev.map((x, j) => j === i ? { ...x, yieldPct: e.target.value } : x))
                        }
                      />
                    </td>
                    <td>
                      <button className="btn-danger btn-sm" onClick={() => removeDraftOutput(i)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <input
              ref={outSearchRef}
              type="text" value={outSearch}
              placeholder="Search item to add as output…"
              onChange={e => setOutSearch(e.target.value)}
              onFocus={() => outResults.length > 0 && setShowOutDrop(true)}
              onBlur={() => setTimeout(() => setShowOutDrop(false), 150)}
              className="search-input"
              style={{ maxWidth: '320px' }}
            />
            {showOutDrop && outResults.length > 0 && (
              <ul className="dropdown-list">
                {outResults.map(i => (
                  <li key={i.id} onMouseDown={() => selectOutputItem(i)}>
                    <span>{i.name}</span>
                    <span className="text-muted">{i.unit_abbreviation}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="form-actions">
            <button className="btn-primary" onClick={saveRule} disabled={saving}>
              {saving ? 'Saving…' : 'Save Rule'}
            </button>
            <button className="btn-ghost" onClick={() => { resetNewRuleForm(); setView('rules') }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Run batch view ─────────────────────────────────────── */}
      {view === 'run' && activeRule && (
        <div className="inline-form" style={{ maxWidth: '560px' }}>
          <h3>Run: {activeRule.name}</h3>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            Input: {activeRule.input_item_name}
            {activeRule.input_variant_name && activeRule.input_variant_name !== activeRule.input_item_name
              ? ` · ${activeRule.input_variant_name}` : ''}
          </p>

          {error && <p className="form-error">{error}</p>}
          {successMsg && <p className="success-msg">{successMsg}</p>}

          <label>
            Input quantity ({activeRule.input_unit_abbreviation})
            <input
              type="number" step="any" min="0.001"
              value={runQty} autoFocus
              onChange={e => onRunQtyChange(e.target.value)}
            />
          </label>

          {runQty && parseFloat(runQty) > 0 && (
            <>
              <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0.75rem 0 0.25rem' }}>
                Outputs — adjust actual if measured differs from expected
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Output</th>
                    <th style={{ textAlign: 'right' }}>Expected</th>
                    <th style={{ textAlign: 'right' }}>Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {runOutputs.map((o, i) => (
                    <tr key={i}>
                      <td>{o.label} <span className="text-muted">({activeRule.outputs[i].yield_pct}%)</span></td>
                      <td style={{ textAlign: 'right' }}>
                        {o.expectedQty.toFixed(2)} {o.unitAbbr}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number" step="any" min="0"
                          value={o.actualQtyStr}
                          style={{ width: '100px', textAlign: 'right' }}
                          onChange={e => onActualQtyChange(i, e.target.value)}
                        />
                        <span style={{ marginLeft: '0.25rem', color: '#6b7280', fontSize: '0.8rem' }}>
                          {o.unitAbbr}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <label style={{ marginTop: '0.75rem' }}>
            Notes (optional)
            <input
              type="text" value={runNotes}
              placeholder="e.g. morning batch, slight moisture"
              onChange={e => setRunNotes(e.target.value)}
            />
          </label>

          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button
              className="btn-primary"
              onClick={saveBatch}
              disabled={saving || !runQty || parseFloat(runQty) <= 0}
            >
              {saving ? 'Saving…' : 'Confirm Batch'}
            </button>
            <button className="btn-ghost" onClick={() => { setView('rules'); setError(''); setSuccessMsg('') }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

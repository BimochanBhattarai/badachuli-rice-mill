import { useEffect, useState } from 'react'
import type { UnitRow } from '../../../shared/types/api'

interface FormState {
  name: string
  abbreviation: string
  baseFactor: string
}

const EMPTY_FORM: FormState = { name: '', abbreviation: '', baseFactor: '1' }

export default function UnitsPage() {
  const [units, setUnits] = useState<UnitRow[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const res = await window.api.units.getAll()
    if (res.ok && res.data) setUnits(res.data)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  function openEdit(u: UnitRow) {
    setEditingId(u.id)
    setForm({ name: u.name, abbreviation: u.abbreviation, baseFactor: String(u.base_factor) })
    setError('')
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const baseFactor = parseFloat(form.baseFactor)
    if (isNaN(baseFactor) || baseFactor <= 0) {
      setError('Base factor must be a positive number')
      return
    }
    setLoading(true)
    const res =
      editingId !== null
        ? await window.api.units.update(editingId, form.name, form.abbreviation, baseFactor)
        : await window.api.units.create(form.name, form.abbreviation, baseFactor)
    setLoading(false)
    if (!res.ok) { setError(res.error ?? 'Unknown error'); return }
    cancel()
    load()
  }

  async function handleDelete(id: number) {
    const res = await window.api.units.delete(id)
    if (!res.ok) { alert(res.error); return }
    load()
  }

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <h2>Units of Measure</h2>
        <button className="btn-primary" onClick={openCreate}>+ Add Unit</button>
      </div>

      {showForm && (
        <div className="inline-form">
          <h3>{editingId !== null ? 'Edit Unit' : 'New Unit'}</h3>
          {error && <p className="form-error">{error}</p>}
          <form onSubmit={submit}>
            <div className="form-row">
              <label>
                Name
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Kilogram"
                  required
                  autoFocus
                />
              </label>
              <label>
                Abbreviation
                <input
                  type="text"
                  value={form.abbreviation}
                  onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))}
                  placeholder="e.g. kg"
                  required
                />
              </label>
              <label>
                Base Factor
                <input
                  type="number"
                  step="any"
                  min="0.000001"
                  value={form.baseFactor}
                  onChange={e => setForm(f => ({ ...f, baseFactor: e.target.value }))}
                  required
                />
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Saving…' : editingId !== null ? 'Update' : 'Create'}
              </button>
              <button type="button" className="btn-ghost" onClick={cancel}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Abbr</th>
            <th>Base Factor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {units.length === 0 && (
            <tr><td colSpan={4} className="empty-state">No units defined</td></tr>
          )}
          {units.map(u => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td><code>{u.abbreviation}</code></td>
              <td>{u.base_factor}</td>
              <td className="row-actions">
                <button className="btn-ghost btn-sm" onClick={() => openEdit(u)}>Edit</button>
                <button className="btn-danger btn-sm" onClick={() => handleDelete(u.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

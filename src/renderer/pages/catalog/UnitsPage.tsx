import { useEffect, useState } from 'react'
import type { UnitRow } from '../../../shared/types/api'
import { useLanguage } from '../../i18n'

interface FormState {
  name: string
  abbreviation: string
  baseFactor: string
}

const EMPTY_FORM: FormState = { name: '', abbreviation: '', baseFactor: '1' }

export default function UnitsPage() {
  const { t } = useLanguage()
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
    try {
      const res =
        editingId !== null
          ? await window.api.units.update(editingId, form.name, form.abbreviation, baseFactor)
          : await window.api.units.create(form.name, form.abbreviation, baseFactor)
      if (!res.ok) { setError(res.error ?? 'Unknown error'); return }
      cancel()
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IPC error — try restarting the app')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await window.api.units.delete(id)
      if (!res.ok) { alert(res.error); return }
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'IPC error')
    }
  }

  async function handleSetDefault(id: number) {
    try {
      const res = await window.api.units.setDefault(id)
      if (!res.ok) { alert(res.error); return }
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'IPC error')
    }
  }

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <h2>{t('units.title')}</h2>
        <button className="btn-primary" onClick={openCreate}>{t('units.add')}</button>
      </div>

      {showForm && (
        <div className="inline-form">
          <h3>{editingId !== null ? t('units.edit') : t('units.new')}</h3>
          {error && <p className="form-error">{error}</p>}
          <form onSubmit={submit}>
            <div className="form-row">
              <label>
                {t('common.name')}
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
                {t('units.abbr')}
                <input
                  type="text"
                  value={form.abbreviation}
                  onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))}
                  placeholder="e.g. kg"
                  required
                />
              </label>
              <label>
                {t('units.base_factor')}
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
                {loading ? t('common.saving') : editingId !== null ? t('common.update') : t('common.create')}
              </button>
              <button type="button" className="btn-ghost" onClick={cancel}>{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>{t('common.name')}</th>
            <th>{t('units.abbr')}</th>
            <th>{t('units.base_factor')}</th>
            <th>{t('units.default_label')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {units.length === 0 && (
            <tr><td colSpan={5} className="empty-state">{t('units.none')}</td></tr>
          )}
          {units.map(u => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td><code>{u.abbreviation}</code></td>
              <td>{u.base_factor}</td>
              <td>
                {u.is_default
                  ? <span className="badge-default">{t('units.default_label')}</span>
                  : (
                    <button className="btn-ghost btn-sm" onClick={() => handleSetDefault(u.id)}>
                      {t('units.set_default')}
                    </button>
                  )
                }
              </td>
              <td className="row-actions">
                <button className="btn-ghost btn-sm" onClick={() => openEdit(u)}>{t('common.edit')}</button>
                {!u.is_default && (
                  <button className="btn-danger btn-sm" onClick={() => handleDelete(u.id)}>{t('common.delete')}</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

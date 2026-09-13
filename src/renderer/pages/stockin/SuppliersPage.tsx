import { useEffect, useState } from 'react'
import type { SupplierRow } from '../../../shared/types/api'
import { useLanguage } from '../../i18n'

interface FormState { name: string; phone: string; address: string; notes: string }
const EMPTY: FormState = { name: '', phone: '', address: '', notes: '' }

export default function SuppliersPage() {
  const { t } = useLanguage()
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = search
      ? await window.api.suppliers.search(search)
      : await window.api.suppliers.getAll()
    if (res.ok && res.data) setSuppliers(res.data)
  }

  useEffect(() => { load() }, [search])

  function openCreate() {
    setEditingId(null); setForm(EMPTY); setError(''); setShowForm(true)
  }

  function openEdit(s: SupplierRow) {
    setEditingId(s.id)
    setForm({ name: s.name, phone: s.phone ?? '', address: s.address ?? '', notes: s.notes ?? '' })
    setError(''); setShowForm(true)
  }

  function cancel() { setShowForm(false); setEditingId(null); setForm(EMPTY); setError('') }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    setSaving(true)
    try {
      const res = editingId !== null
        ? await window.api.suppliers.update(editingId, form.name, form.phone || undefined, form.address || undefined, form.notes || undefined)
        : await window.api.suppliers.create(form.name, form.phone || undefined, form.address || undefined, form.notes || undefined)
      if (!res.ok) { setError(res.error ?? 'Error'); return }
      cancel(); load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <h2>{t('supplier.title')}</h2>
        <button className="btn-primary" onClick={openCreate}>{t('supplier.add')}</button>
      </div>

      <div className="catalog-filters">
        <input type="text" placeholder={t('customer.search')} value={search}
          onChange={e => setSearch(e.target.value)} className="search-input" />
      </div>

      {showForm && (
        <div className="inline-form">
          <h3>{editingId !== null ? t('supplier.edit') : t('supplier.new')}</h3>
          {error && <p className="form-error">{error}</p>}
          <form onSubmit={submit}>
            <div className="form-row">
              <label>{t('common.name')}<input type="text" value={form.name} required autoFocus
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
              <label>{t('common.phone')}<input type="text" value={form.phone} placeholder={t('common.optional')}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></label>
              <label>{t('common.address')}<input type="text" value={form.address} placeholder={t('common.optional')}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></label>
              <label>{t('common.notes')}<input type="text" value={form.notes} placeholder={t('common.optional')}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></label>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t('common.saving') : editingId !== null ? t('common.update') : t('common.create')}
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
            <th>{t('common.phone')}</th>
            <th>{t('common.address')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {suppliers.length === 0 && <tr><td colSpan={4} className="empty-state">{t('supplier.none')}</td></tr>}
          {suppliers.map(s => (
            <tr key={s.id}>
              <td style={{ fontWeight: 600 }}>{s.name}</td>
              <td className="text-muted">{s.phone ?? '—'}</td>
              <td className="text-muted">{s.address ?? '—'}</td>
              <td className="row-actions">
                <button className="btn-ghost btn-sm" onClick={() => openEdit(s)}>{t('common.edit')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

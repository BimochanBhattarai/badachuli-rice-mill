import { useEffect, useState } from 'react'
import type { AuthUser, ExpenseCategoryRow, ExpenseRow, CustomerLoanRow, EmployeeRow, SalaryPaymentRow, EmployeeLoanRow, EmployeeRemaining } from '@shared/types/api'
import type { CustomerWithBalance } from '@shared/types/api'
import { useLanguage } from '../../i18n'

type Tab = 'general' | 'loans' | 'salary'

interface Props {
  currentUser: AuthUser
}

export default function ExpensesPage({ currentUser }: Props) {
  const { t } = useLanguage()
  const [tab, setTab] = useState<Tab>('general')

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <h2>{t('expense.title')}</h2>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {(['general', 'loans', 'salary'] as Tab[]).map(tabId => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={tab === tabId ? 'btn-primary' : 'btn-ghost'}
            style={{ fontWeight: 600, fontSize: '0.875rem' }}
          >
            {t(
              tabId === 'general'
                ? 'expense.tab_general'
                : tabId === 'loans'
                  ? 'expense.tab_loans'
                  : 'expense.tab_salary'
            )}
          </button>
        ))}
      </div>
      {tab === 'general' && <GeneralExpensesTab currentUser={currentUser} />}
      {tab === 'loans'   && <CustomerLoansTab currentUser={currentUser} />}
      {tab === 'salary'  && <SalaryTab currentUser={currentUser} />}
    </div>
  )
}

// ── General Expenses ─────────────────────────────────────────────────────────

interface GeneralExpFormState {
  categoryId: string
  amount: string
  date: string
  description: string
}

const EMPTY_EXP: GeneralExpFormState = { categoryId: '', amount: '', date: '', description: '' }

function GeneralExpensesTab({ currentUser }: Props) {
  const { t, fmtAmt, fmtDate } = useLanguage()
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<GeneralExpFormState>(EMPTY_EXP)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [catSaving, setCatSaving] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<GeneralExpFormState>(EMPTY_EXP)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  async function loadCategories() {
    const res = await window.api.expenses.getCategories()
    if (res.ok && res.data) setCategories(res.data)
  }

  async function load() {
    const res = await window.api.expenses.getAll()
    if (res.ok && res.data) setExpenses(res.data)
  }

  useEffect(() => {
    loadCategories()
    load()
  }, [])

  function openCreate() {
    setForm({ ...EMPTY_EXP, date: new Date().toISOString().slice(0, 10) })
    setError('')
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setForm(EMPTY_EXP)
    setError('')
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    setCatSaving(true)
    const res = await window.api.expenses.createCategory(newCatName.trim(), currentUser.id)
    if (res.ok) {
      await loadCategories()
      setNewCatName('')
      setShowNewCat(false)
    }
    setCatSaving(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const catId = parseInt(form.categoryId)
    const amount = parseFloat(form.amount)
    if (!catId) { setError('Select a category'); return }
    if (isNaN(amount) || amount <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    try {
      const res = await window.api.expenses.create(
        catId, amount, currentUser.id,
        form.description || undefined,
        form.date || undefined
      )
      if (!res.ok) { setError(res.error ?? 'Error'); return }
      cancel()
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(exp: ExpenseRow) {
    setEditingId(exp.id)
    setEditForm({
      categoryId: String(exp.category_id),
      amount: String(exp.amount),
      date: exp.expense_date,
      description: exp.description ?? '',
    })
    setEditError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(EMPTY_EXP)
    setEditError('')
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (editingId === null) return
    setEditError('')
    const catId = parseInt(editForm.categoryId)
    const amount = parseFloat(editForm.amount)
    if (!catId) { setEditError('Select a category'); return }
    if (isNaN(amount) || amount <= 0) { setEditError('Enter a valid amount'); return }
    setEditSaving(true)
    try {
      const res = await window.api.expenses.update(
        editingId, catId, amount,
        editForm.description.trim() || null,
        editForm.date,
        currentUser.id
      )
      if (!res.ok) { setEditError(res.error ?? 'Error'); return }
      cancelEdit()
      load()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setEditSaving(false)
    }
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <>
      <div className="catalog-filters" style={{ justifyContent: 'flex-end' }}>
        {!showForm && (
          <button className="btn-primary" onClick={openCreate}>{t('expense.add')}</button>
        )}
      </div>

      {showForm && (
        <div className="inline-form">
          <h3 style={{ marginBottom: '0.75rem', fontWeight: 700 }}>{t('expense.new')}</h3>
          {error && <p className="form-error">{error}</p>}
          <form onSubmit={submit}>
            <div className="form-row">
              <label>
                {t('expense.category')}
                <select
                  value={form.categoryId}
                  required
                  onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                >
                  <option value="">— select —</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {!showNewCat ? (
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    style={{ marginTop: '0.35rem' }}
                    onClick={() => setShowNewCat(true)}
                  >
                    {t('expense.add_category')}
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                    <input
                      type="text"
                      placeholder={t('expense.new_category')}
                      value={newCatName}
                      autoFocus
                      onChange={e => setNewCatName(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="btn-primary btn-sm" disabled={catSaving} onClick={addCategory}>
                      {t('common.add')}
                    </button>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => { setShowNewCat(false); setNewCatName('') }}>
                      {t('common.cancel')}
                    </button>
                  </div>
                )}
              </label>
              <label>
                {t('common.amount')}
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </label>
              <label>
                {t('common.date')}
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </label>
              <label>
                {t('common.notes')} <span className="text-muted">({t('common.optional')})</span>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
              <button type="button" className="btn-ghost" onClick={cancel}>{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>{t('expense.category')}</th>
            <th>{t('common.date')}</th>
            <th style={{ textAlign: 'right' }}>{t('common.amount')}</th>
            <th>{t('common.notes')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 && (
            <tr><td colSpan={5} className="empty-state">{t('expense.none')}</td></tr>
          )}
          {expenses.map(exp => {
            if (editingId === exp.id) {
              return (
                <tr key={exp.id} style={{ background: '#fffbf0' }}>
                  <td colSpan={5} style={{ padding: '0.6rem 0.75rem' }}>
                    {editError && <p className="form-error" style={{ marginBottom: '0.4rem' }}>{editError}</p>}
                    <form onSubmit={submitEdit}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: '0 0 160px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78716c', textTransform: 'uppercase' }}>{t('expense.category')}</span>
                          <select
                            value={editForm.categoryId}
                            required
                            onChange={e => setEditForm(f => ({ ...f, categoryId: e.target.value }))}
                          >
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: '0 0 100px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78716c', textTransform: 'uppercase' }}>{t('common.date')}</span>
                          <input
                            type="date"
                            required
                            value={editForm.date}
                            onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                          />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: '0 0 110px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78716c', textTransform: 'uppercase' }}>{t('common.amount')}</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            autoFocus
                            value={editForm.amount}
                            onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                          />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: '120px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78716c', textTransform: 'uppercase' }}>{t('common.notes')}</span>
                          <input
                            type="text"
                            value={editForm.description}
                            onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                          />
                        </label>
                        <div style={{ display: 'flex', gap: '0.4rem', paddingBottom: '1px' }}>
                          <button type="submit" className="btn-primary btn-sm" disabled={editSaving}>
                            {editSaving ? t('common.saving') : t('common.save')}
                          </button>
                          <button type="button" className="btn-ghost btn-sm" onClick={cancelEdit}>
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    </form>
                  </td>
                </tr>
              )
            }
            return (
              <tr key={exp.id}>
                <td style={{ fontWeight: 600 }}>{exp.category_name}</td>
                <td className="text-muted">{fmtDate(exp.expense_date)}</td>
                <td style={{ textAlign: 'right' }}>{fmtAmt(exp.amount)}</td>
                <td className="text-muted">{exp.description ?? '—'}</td>
                <td className="row-actions">
                  <button className="btn-ghost btn-sm" onClick={() => startEdit(exp)}>
                    {t('common.edit')}
                  </button>
                </td>
              </tr>
            )
          })}
          {expenses.length > 0 && (
            <tr style={{ background: '#faf8f5' }}>
              <td colSpan={2} style={{ fontWeight: 700 }}>{t('expense.total')}</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtAmt(total)}</td>
              <td colSpan={2}></td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}

// ── Customer Loans ────────────────────────────────────────────────────────────

interface LoanFormState {
  customerId: string
  amount: string
  date: string
  description: string
}

const EMPTY_LOAN: LoanFormState = { customerId: '', amount: '', date: '', description: '' }

function CustomerLoansTab({ currentUser }: Props) {
  const { t, fmtAmt, fmtDate } = useLanguage()
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([])
  const [loans, setLoans] = useState<CustomerLoanRow[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<LoanFormState>(EMPTY_LOAN)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const [custRes, loanRes] = await Promise.all([
      window.api.customers.getAll(),
      window.api.loans.getAll(),
    ])
    if (custRes.ok && custRes.data) setCustomers(custRes.data)
    if (loanRes.ok && loanRes.data) setLoans(loanRes.data)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setForm({ ...EMPTY_LOAN, date: new Date().toISOString().slice(0, 10) })
    setError('')
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setForm(EMPTY_LOAN)
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const custId = parseInt(form.customerId)
    const amount = parseFloat(form.amount)
    if (!custId) { setError('Select a customer'); return }
    if (isNaN(amount) || amount <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    try {
      const res = await window.api.loans.create(
        custId, amount, currentUser.id,
        form.description || undefined,
        form.date || undefined
      )
      if (!res.ok) { setError(res.error ?? 'Error'); return }
      cancel()
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="catalog-filters" style={{ justifyContent: 'flex-end' }}>
        {!showForm && (
          <button className="btn-primary" onClick={openCreate}>{t('loan.add')}</button>
        )}
      </div>

      {showForm && (
        <div className="inline-form">
          <h3 style={{ marginBottom: '0.75rem', fontWeight: 700 }}>{t('loan.new')}</h3>
          {error && <p className="form-error">{error}</p>}
          <form onSubmit={submit}>
            <div className="form-row">
              <label>
                {t('loan.customer')}
                <select
                  value={form.customerId}
                  required
                  onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                >
                  <option value="">— select —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('loan.amount')}
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </label>
              <label>
                {t('loan.date')}
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </label>
              <label>
                {t('loan.description')} <span className="text-muted">({t('common.optional')})</span>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
              <button type="button" className="btn-ghost" onClick={cancel}>{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      <div
        className="inline-form"
        style={{ marginBottom: '1rem', background: '#fffbf0', borderColor: '#f0d78c' }}
      >
        <p style={{ fontSize: '0.82rem', color: '#78716c', margin: 0 }}>
          ℹ️ {t('loan.repayment_hint')}
        </p>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>{t('loan.customer')}</th>
            <th>{t('loan.date')}</th>
            <th style={{ textAlign: 'right' }}>{t('loan.amount')}</th>
            <th>{t('loan.description')}</th>
          </tr>
        </thead>
        <tbody>
          {loans.length === 0 && (
            <tr><td colSpan={4} className="empty-state">{t('loan.none')}</td></tr>
          )}
          {loans.map(loan => (
            <tr key={loan.id}>
              <td style={{ fontWeight: 600 }}>{loan.customer_name}</td>
              <td className="text-muted">{fmtDate(loan.loan_date)}</td>
              <td style={{ textAlign: 'right' }}>{fmtAmt(loan.amount)}</td>
              <td className="text-muted">{loan.description ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// ── Salary ────────────────────────────────────────────────────────────────────

interface EmpFormState { name: string; phone: string; position: string; baseSalary: string }
const EMPTY_EMP: EmpFormState = { name: '', phone: '', position: '', baseSalary: '' }

interface PayFormState { amount: string; txnType: string; date: string; description: string }
const EMPTY_PAY: PayFormState = { amount: '', txnType: 'advance', date: '', description: '' }

interface EmpLoanFormState { amount: string; date: string; reason: string }
const EMPTY_LOAN_FORM: EmpLoanFormState = { amount: '', date: '', reason: '' }

interface RepayFormState { loanId: number; amount: string; date: string }

interface EditLoanFormState { loanId: number; amount: string; date: string; reason: string }

function SalaryTab({ currentUser }: Props) {
  const { t, fmtAmt, fmtDate } = useLanguage()
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [selectedEmp, setSelectedEmp] = useState<EmployeeRow | null>(null)
  const [payments, setPayments] = useState<SalaryPaymentRow[]>([])
  const [empLoans, setEmpLoans] = useState<EmployeeLoanRow[]>([])
  const [remaining, setRemaining] = useState<EmployeeRemaining | null>(null)
  const [payingRemaining, setPayingRemaining] = useState(false)
  const [payMsg, setPayMsg] = useState('')

  const [showEmpForm, setShowEmpForm] = useState(false)
  const [editingEmpId, setEditingEmpId] = useState<number | null>(null)
  const [empForm, setEmpForm] = useState<EmpFormState>(EMPTY_EMP)
  const [empError, setEmpError] = useState('')
  const [empSaving, setEmpSaving] = useState(false)

  const [showPayForm, setShowPayForm] = useState(false)
  const [payForm, setPayForm] = useState<PayFormState>(EMPTY_PAY)
  const [payError, setPayError] = useState('')
  const [paySaving, setPaySaving] = useState(false)

  const [showLoanForm, setShowLoanForm] = useState(false)
  const [loanForm, setLoanForm] = useState<EmpLoanFormState>(EMPTY_LOAN_FORM)
  const [loanError, setLoanError] = useState('')
  const [loanSaving, setLoanSaving] = useState(false)

  const [repayForm, setRepayForm] = useState<RepayFormState | null>(null)
  const [repayError, setRepayError] = useState('')
  const [repaySaving, setRepaySaving] = useState(false)

  const [editLoanForm, setEditLoanForm] = useState<EditLoanFormState | null>(null)
  const [editLoanError, setEditLoanError] = useState('')
  const [editLoanSaving, setEditLoanSaving] = useState(false)

  const [showPayConfirm, setShowPayConfirm] = useState(false)
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null)
  const [deletePaymentSaving, setDeletePaymentSaving] = useState(false)
  const [deletePaymentError, setDeletePaymentError] = useState('')

  async function loadEmployees() {
    const res = await window.api.salary.getEmployees()
    if (res.ok && res.data) setEmployees(res.data)
  }

  async function loadRemaining(empId: number) {
    const res = await window.api.salary.getRemaining(empId)
    if (res.ok && res.data) setRemaining(res.data)
    else setRemaining(null)
  }

  async function loadDetail(empId: number) {
    const [payRes, loanRes] = await Promise.all([
      window.api.salary.getPayments(empId),
      window.api.salary.getEmployeeLoans(empId),
    ])
    if (payRes.ok && payRes.data) setPayments(payRes.data)
    if (loanRes.ok && loanRes.data) setEmpLoans(loanRes.data)
    await loadRemaining(empId)
  }

  useEffect(() => { loadEmployees() }, [])

  async function selectEmployee(emp: EmployeeRow) {
    setSelectedEmp(emp)
    setShowPayForm(false)
    setShowLoanForm(false)
    setRepayForm(null)
    setEditLoanForm(null)
    setPayForm(EMPTY_PAY)
    setRemaining(null)
    setPayMsg('')
    await loadDetail(emp.id)
  }

  // ── Employee CRUD ──────────────────────────────────────────────────────────
  function openCreateEmp() {
    setEditingEmpId(null)
    setEmpForm(EMPTY_EMP)
    setEmpError('')
    setShowEmpForm(true)
  }

  function openEditEmp(emp: EmployeeRow) {
    setEditingEmpId(emp.id)
    setEmpForm({
      name: emp.name,
      phone: emp.phone ?? '',
      position: emp.position ?? '',
      baseSalary: emp.base_salary > 0 ? String(emp.base_salary) : '',
    })
    setEmpError('')
    setShowEmpForm(true)
  }

  async function submitEmp(e: React.FormEvent) {
    e.preventDefault()
    setEmpError('')
    if (!empForm.name.trim()) { setEmpError('Name is required'); return }
    setEmpSaving(true)
    try {
      const phone = empForm.phone.trim() || undefined
      const position = empForm.position.trim() || undefined
      const baseSalary = empForm.baseSalary.trim() ? parseFloat(empForm.baseSalary) : undefined
      if (baseSalary !== undefined && (isNaN(baseSalary) || baseSalary < 0)) {
        setEmpError('Base salary must be a positive number'); return
      }
      const res = editingEmpId !== null
        ? await window.api.salary.updateEmployee(editingEmpId, empForm.name.trim(), phone, position, currentUser.id, baseSalary)
        : await window.api.salary.createEmployee(empForm.name.trim(), phone, position, currentUser.id, baseSalary)
      if (!res.ok) { setEmpError(res.error ?? 'Error'); return }
      setShowEmpForm(false)
      setEmpForm(EMPTY_EMP)
      await loadEmployees()
      // refresh selected employee data if it was the one being edited
      if (editingEmpId !== null && selectedEmp?.id === editingEmpId) {
        const empRes = await window.api.salary.getEmployees()
        if (empRes.ok && empRes.data) {
          const updated = empRes.data.find(e => e.id === editingEmpId)
          if (updated) setSelectedEmp(updated)
        }
      }
    } catch (err) {
      setEmpError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setEmpSaving(false)
    }
  }

  async function deactivate(id: number) {
    if (!confirm('Deactivate this employee?')) return
    await window.api.salary.deactivateEmployee(id, currentUser.id)
    if (selectedEmp?.id === id) { setSelectedEmp(null); setPayments([]); setEmpLoans([]); setRemaining(null) }
    loadEmployees()
  }

  // ── Salary payments ────────────────────────────────────────────────────────
  function openPayForm() {
    setShowLoanForm(false)
    setRepayForm(null)
    setPayForm({ ...EMPTY_PAY, date: new Date().toISOString().slice(0, 10) })
    setPayError('')
    setShowPayForm(true)
  }

  async function submitPay(e: React.FormEvent) {
    e.preventDefault()
    setPayError('')
    const amount = parseFloat(payForm.amount)
    if (!selectedEmp) return
    if (isNaN(amount) || amount <= 0) { setPayError('Enter a valid amount'); return }
    setPaySaving(true)
    try {
      const res = await window.api.salary.recordPayment(
        selectedEmp.id, amount, payForm.txnType, currentUser.id,
        payForm.description || undefined,
        payForm.date || undefined
      )
      if (!res.ok) { setPayError(res.error ?? 'Error'); return }
      setShowPayForm(false)
      setPayForm(EMPTY_PAY)
      await loadDetail(selectedEmp.id)
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setPaySaving(false)
    }
  }

  async function confirmDeletePayment() {
    if (!deletingPaymentId || !selectedEmp) return
    setDeletePaymentSaving(true)
    setDeletePaymentError('')
    try {
      const res = await window.api.salary.deletePayment(deletingPaymentId, currentUser.id)
      if (!res.ok) { setDeletePaymentError(res.error ?? 'Delete failed'); return }
      setDeletingPaymentId(null)
      await loadDetail(selectedEmp.id)
    } catch (err) {
      setDeletePaymentError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setDeletePaymentSaving(false)
    }
  }

  // ── Employee loans ─────────────────────────────────────────────────────────
  function openLoanForm() {
    setShowPayForm(false)
    setRepayForm(null)
    setEditLoanForm(null)
    setLoanForm({ ...EMPTY_LOAN_FORM, date: new Date().toISOString().slice(0, 10) })
    setLoanError('')
    setShowLoanForm(true)
  }

  async function submitLoan(e: React.FormEvent) {
    e.preventDefault()
    setLoanError('')
    const amount = parseFloat(loanForm.amount)
    if (!selectedEmp) return
    if (isNaN(amount) || amount <= 0) { setLoanError('Enter a valid amount'); return }
    setLoanSaving(true)
    try {
      const res = await window.api.salary.createEmployeeLoan(
        selectedEmp.id, amount, currentUser.id,
        loanForm.reason || undefined,
        loanForm.date || undefined
      )
      if (!res.ok) { setLoanError(res.error ?? 'Error'); return }
      setShowLoanForm(false)
      setLoanForm(EMPTY_LOAN_FORM)
      await loadDetail(selectedEmp.id)
    } catch (err) {
      setLoanError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setLoanSaving(false)
    }
  }

  // ── Loan repayment ─────────────────────────────────────────────────────────
  function openRepay(loan: EmployeeLoanRow) {
    setShowPayForm(false)
    setShowLoanForm(false)
    setEditLoanForm(null)
    setRepayForm({ loanId: loan.id, amount: '', date: new Date().toISOString().slice(0, 10) })
    setRepayError('')
  }

  async function submitRepay(e: React.FormEvent) {
    e.preventDefault()
    if (!repayForm || !selectedEmp) return
    setRepayError('')
    const amount = parseFloat(repayForm.amount)
    if (isNaN(amount) || amount <= 0) { setRepayError('Enter a valid amount'); return }
    setRepaySaving(true)
    try {
      const res = await window.api.salary.recordLoanRepayment(
        repayForm.loanId, selectedEmp.id, amount, currentUser.id,
        repayForm.date || undefined
      )
      if (!res.ok) { setRepayError(res.error ?? 'Error'); return }
      setRepayForm(null)
      await loadDetail(selectedEmp.id)
    } catch (err) {
      setRepayError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setRepaySaving(false)
    }
  }

  // ── Edit loan ──────────────────────────────────────────────────────────────
  function openEditLoan(loan: EmployeeLoanRow) {
    setShowPayForm(false)
    setShowLoanForm(false)
    setRepayForm(null)
    setEditLoanError('')
    setEditLoanForm({
      loanId: loan.id,
      amount: String(loan.amount),
      date: loan.loan_date.slice(0, 10),
      reason: loan.description ?? '',
    })
  }

  async function submitEditLoan(e: React.FormEvent) {
    e.preventDefault()
    if (!editLoanForm || !selectedEmp) return
    setEditLoanError('')
    const amount = parseFloat(editLoanForm.amount)
    if (isNaN(amount) || amount <= 0) { setEditLoanError('Enter a valid amount'); return }
    setEditLoanSaving(true)
    try {
      const res = await window.api.salary.updateEmployeeLoan(
        editLoanForm.loanId, selectedEmp.id, amount, currentUser.id,
        editLoanForm.reason || undefined,
        editLoanForm.date || undefined
      )
      if (!res.ok) { setEditLoanError(res.error ?? 'Error'); return }
      setEditLoanForm(null)
      await loadDetail(selectedEmp.id)
    } catch (err) {
      setEditLoanError(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setEditLoanSaving(false)
    }
  }

  // ── Pay remaining salary ───────────────────────────────────────────────────
  async function doPayRemaining() {
    if (!selectedEmp) return
    setPayMsg('')
    setPayingRemaining(true)
    try {
      const res = await window.api.salary.payRemaining(selectedEmp.id, currentUser.id)
      if (!res.ok) { setPayMsg(res.error ?? 'Error'); return }
      await loadDetail(selectedEmp.id)
    } catch (err) {
      setPayMsg(err instanceof Error ? err.message : 'IPC error')
    } finally {
      setPayingRemaining(false)
    }
  }

  const txnTypes = [
    { key: 'advance',   label: t('salary.type_advance') },
    { key: 'salary',    label: t('salary.type_salary') },
    { key: 'bonus',     label: t('salary.type_bonus') },
    { key: 'deduction', label: t('salary.type_deduction') },
  ]

  // Net Paid = actual cash given (salary + advance + bonus).
  // Deductions are NOT cash — they reduce future "Pay Remaining" salary amounts,
  // so subtracting them again would double-count.
  const netPaid = payments.reduce((sum, p) => {
    if (p.txn_type === 'deduction') return sum
    return sum + p.amount
  }, 0)

  const totalLoanOutstanding = empLoans
    .filter(l => l.status === 'active')
    .reduce((sum, l) => sum + l.due_amount, 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.25rem', alignItems: 'start' }}>
      {/* Employee list */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('salary.employees')}
          </span>
          <button className="btn-ghost btn-sm" onClick={openCreateEmp}>{t('salary.add_employee')}</button>
        </div>

        {showEmpForm && (
          <div className="inline-form" style={{ marginBottom: '0.75rem' }}>
            <h4 style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              {editingEmpId !== null ? t('salary.edit_employee') : t('salary.new_employee')}
            </h4>
            {empError && <p className="form-error">{empError}</p>}
            <form onSubmit={submitEmp}>
              <label style={{ display: 'block', marginBottom: '0.4rem' }}>
                {t('common.name')}
                <input type="text" required autoFocus value={empForm.name}
                  onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))} />
              </label>
              <label style={{ display: 'block', marginBottom: '0.4rem' }}>
                {t('common.phone')} <span className="text-muted">({t('common.optional')})</span>
                <input type="text" value={empForm.phone}
                  onChange={e => setEmpForm(f => ({ ...f, phone: e.target.value }))} />
              </label>
              <label style={{ display: 'block', marginBottom: '0.4rem' }}>
                {t('salary.position')} <span className="text-muted">({t('common.optional')})</span>
                <input type="text" value={empForm.position}
                  onChange={e => setEmpForm(f => ({ ...f, position: e.target.value }))} />
              </label>
              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                {t('salary.base_salary')} <span className="text-muted">({t('common.optional')})</span>
                <input type="number" step="1" min="0" value={empForm.baseSalary}
                  onChange={e => setEmpForm(f => ({ ...f, baseSalary: e.target.value }))} />
              </label>
              <div className="form-actions">
                <button type="submit" className="btn-primary btn-sm" disabled={empSaving}>
                  {empSaving ? t('common.saving') : t('common.save')}
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setShowEmpForm(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {employees.length === 0 && !showEmpForm && (
          <p className="text-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>{t('salary.no_employees')}</p>
        )}
        {employees.map(emp => (
          <div
            key={emp.id}
            onClick={() => selectEmployee(emp)}
            style={{
              background: selectedEmp?.id === emp.id ? '#fff7ed' : '#fff',
              border: `1.5px solid ${selectedEmp?.id === emp.id ? '#f97316' : '#e7e0d8'}`,
              borderRadius: 10,
              padding: '0.7rem 0.9rem',
              marginBottom: '0.5rem',
              cursor: 'pointer',
              transition: 'border-color 0.12s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{emp.name}</div>
                {emp.position && <div className="text-muted">{emp.position}</div>}
                {emp.base_salary > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#78716c' }}>
                    {fmtAmt(emp.base_salary)}/mo
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button className="btn-ghost btn-sm"
                  onClick={ev => { ev.stopPropagation(); openEditEmp(emp) }}>
                  {t('common.edit')}
                </button>
                <button className="btn-danger btn-sm"
                  onClick={ev => { ev.stopPropagation(); deactivate(emp.id) }}>
                  {t('salary.deactivate')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Right panel */}
      <div>
        {!selectedEmp ? (
          <p className="text-muted" style={{ textAlign: 'center', paddingTop: '3rem' }}>
            {t('salary.select_employee')}
          </p>
        ) : (
          <>
            {/* Employee header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedEmp.name}</span>
                {selectedEmp.position && (
                  <span className="text-muted" style={{ marginLeft: '0.5rem' }}>{selectedEmp.position}</span>
                )}
                {totalLoanOutstanding > 0.005 && (
                  <span style={{
                    marginLeft: '0.75rem', background: '#fef2f2', color: '#dc2626',
                    border: '1px solid #fca5a5', borderRadius: 6, padding: '0.1rem 0.5rem',
                    fontSize: '0.78rem', fontWeight: 700,
                  }}>
                    {t('salary.loan_outstanding')}: {fmtAmt(totalLoanOutstanding)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="btn-ghost btn-sm" onClick={openLoanForm}>{t('salary.add_loan')}</button>
                <button className="btn-primary btn-sm" onClick={openPayForm}>{t('salary.add_payment')}</button>
              </div>
            </div>

            {/* Salary remaining panel */}
            {selectedEmp.base_salary > 0 && remaining && (
              <div style={{
                marginBottom: '1.25rem',
                border: '1.5px solid #fdba74',
                borderRadius: 10,
                padding: '0.9rem 1.1rem',
                background: '#fff7ed',
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
                  {t('salary.cycle_title')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#78716c', marginBottom: '0.15rem' }}>{t('salary.cycle_base')}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{fmtAmt(remaining.base_salary)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#78716c', marginBottom: '0.15rem' }}>{t('salary.cycle_deducted')}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#dc2626' }}>− {fmtAmt(remaining.total_deducted)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#78716c', marginBottom: '0.15rem' }}>{t('salary.cycle_remaining')}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#15803d' }}>{fmtAmt(remaining.remaining)}</div>
                  </div>
                </div>
                {payMsg && <p style={{ fontSize: '0.8rem', color: '#dc2626', margin: '0 0 0.5rem' }}>{payMsg}</p>}
                <button
                  className="btn-primary"
                  style={{ width: '100%' }}
                  disabled={payingRemaining || remaining.remaining <= 0}
                  onClick={() => setShowPayConfirm(true)}
                >
                  {payingRemaining ? t('common.saving') : t('salary.pay_remaining')}
                </button>
              </div>
            )}

            {/* Loan form */}
            {showLoanForm && (
              <div className="inline-form" style={{ marginBottom: '1rem', borderColor: '#fca5a5', background: '#fff8f8' }}>
                <h4 style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.875rem' }}>{t('salary.new_loan')}</h4>
                {loanError && <p className="form-error">{loanError}</p>}
                <form onSubmit={submitLoan}>
                  <div className="form-row">
                    <label>
                      {t('salary.loan_amount')}
                      <input type="number" step="0.01" min="0.01" required autoFocus
                        value={loanForm.amount}
                        onChange={e => setLoanForm(f => ({ ...f, amount: e.target.value }))} />
                    </label>
                    <label>
                      {t('salary.loan_date')}
                      <input type="date" required value={loanForm.date}
                        onChange={e => setLoanForm(f => ({ ...f, date: e.target.value }))} />
                    </label>
                    <label>
                      {t('salary.loan_reason')} <span className="text-muted">({t('common.optional')})</span>
                      <input type="text" value={loanForm.reason}
                        onChange={e => setLoanForm(f => ({ ...f, reason: e.target.value }))} />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={loanSaving}>
                      {loanSaving ? t('common.saving') : t('common.save')}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setShowLoanForm(false)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Repayment form */}
            {repayForm && (
              <div className="inline-form" style={{ marginBottom: '1rem', borderColor: '#86efac', background: '#f0fdf4' }}>
                <h4 style={{ fontWeight: 700, marginBottom: '0.35rem', fontSize: '0.875rem' }}>{t('salary.repay_title')}</h4>
                <p style={{ fontSize: '0.8rem', color: '#78716c', marginBottom: '0.65rem' }}>{t('salary.repay_hint')}</p>
                {repayError && <p className="form-error">{repayError}</p>}
                <form onSubmit={submitRepay}>
                  <div className="form-row">
                    <label>
                      {t('salary.repay_amount')}
                      <input type="number" step="0.01" min="0.01" required autoFocus
                        value={repayForm.amount}
                        onChange={e => setRepayForm(f => f ? { ...f, amount: e.target.value } : f)} />
                    </label>
                    <label>
                      {t('salary.repay_date')}
                      <input type="date" required value={repayForm.date}
                        onChange={e => setRepayForm(f => f ? { ...f, date: e.target.value } : f)} />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={repaySaving}>
                      {repaySaving ? t('common.saving') : t('common.save')}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setRepayForm(null)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Edit loan form */}
            {editLoanForm && (
              <div className="inline-form" style={{ marginBottom: '1rem' }}>
                <h4 style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.875rem' }}>{t('salary.edit_loan')}</h4>
                {editLoanError && <p className="form-error">{editLoanError}</p>}
                <form onSubmit={submitEditLoan}>
                  <div className="form-row">
                    <label>
                      {t('salary.loan_amount')}
                      <input type="number" step="0.01" min="0.01" required autoFocus
                        value={editLoanForm.amount}
                        onChange={e => setEditLoanForm(f => f ? { ...f, amount: e.target.value } : f)} />
                    </label>
                    <label>
                      {t('salary.loan_date')}
                      <input type="date" required value={editLoanForm.date}
                        onChange={e => setEditLoanForm(f => f ? { ...f, date: e.target.value } : f)} />
                    </label>
                    <label>
                      {t('salary.loan_reason')} <span className="text-muted">({t('common.optional')})</span>
                      <input type="text" value={editLoanForm.reason}
                        onChange={e => setEditLoanForm(f => f ? { ...f, reason: e.target.value } : f)} />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={editLoanSaving}>
                      {editLoanSaving ? t('common.saving') : t('common.save')}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setEditLoanForm(null)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Employee loans section */}
            {empLoans.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  {t('salary.loans')}
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('salary.loan_date')}</th>
                      <th>{t('salary.loan_reason')}</th>
                      <th style={{ textAlign: 'right' }}>{t('salary.loan_amount')}</th>
                      <th style={{ textAlign: 'right' }}>{t('salary.loan_outstanding')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {empLoans.map(loan => (
                      <tr key={loan.id}>
                        <td className="text-muted">{fmtDate(loan.loan_date)}</td>
                        <td>{loan.description ?? '—'}</td>
                        <td style={{ textAlign: 'right' }}>{fmtAmt(loan.amount)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: loan.due_amount > 0.005 ? '#dc2626' : '#15803d' }}>
                          {loan.due_amount > 0.005 ? fmtAmt(loan.due_amount) : (
                            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{t('salary.loan_settled')}</span>
                          )}
                        </td>
                        <td className="row-actions">
                          {loan.status === 'active' && (
                            <button className="btn-ghost btn-sm" onClick={() => openEditLoan(loan)}>
                              {t('common.edit')}
                            </button>
                          )}
                          {loan.due_amount > 0.005 && loan.status === 'active' && (
                            <button className="btn-ghost btn-sm" onClick={() => openRepay(loan)}>
                              {t('salary.loan_repay')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Payment form */}
            {showPayForm && (
              <div className="inline-form" style={{ marginBottom: '1rem' }}>
                <h4 style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.875rem' }}>{t('salary.new_payment')}</h4>
                {payError && <p className="form-error">{payError}</p>}
                <form onSubmit={submitPay}>
                  <div className="form-row">
                    <label>
                      {t('salary.txn_type')}
                      <select value={payForm.txnType}
                        onChange={e => setPayForm(f => ({ ...f, txnType: e.target.value }))}>
                        {txnTypes.map(tt => (
                          <option key={tt.key} value={tt.key}>{tt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t('common.amount')}
                      <input type="number" step="0.01" min="0.01" required autoFocus
                        value={payForm.amount}
                        onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
                    </label>
                    <label>
                      {t('common.date')}
                      <input type="date" required value={payForm.date}
                        onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} />
                    </label>
                    <label>
                      {t('common.notes')} <span className="text-muted">({t('common.optional')})</span>
                      <input type="text" value={payForm.description}
                        onChange={e => setPayForm(f => ({ ...f, description: e.target.value }))} />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={paySaving}>
                      {paySaving ? t('common.saving') : t('common.save')}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setShowPayForm(false)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Payment history */}
            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              {t('salary.history')}
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('salary.txn_type')}</th>
                  <th>{t('common.date')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.amount')}</th>
                  <th>{t('common.notes')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 && (
                  <tr><td colSpan={5} className="empty-state">{t('salary.no_payments')}</td></tr>
                )}
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.15rem 0.55rem',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: p.txn_type === 'deduction' ? '#fef2f2' : p.txn_type === 'advance' ? '#fffbf0' : p.txn_type === 'bonus' ? '#f0fdf4' : '#fff7ed',
                        color: p.txn_type === 'deduction' ? '#dc2626' : p.txn_type === 'advance' ? '#b45309' : p.txn_type === 'bonus' ? '#15803d' : '#c2410c',
                      }}>
                        {t(`salary.type_${p.txn_type}` as Parameters<typeof t>[0])}
                      </span>
                    </td>
                    <td className="text-muted">{fmtDate(p.paid_date)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: p.txn_type === 'deduction' ? '#dc2626' : undefined }}>
                      {p.txn_type === 'deduction' ? `− ${fmtAmt(p.amount)}` : fmtAmt(p.amount)}
                    </td>
                    <td className="text-muted">{p.description ?? '—'}</td>
                    <td>
                      <button
                        className="btn-ghost btn-sm"
                        style={{ color: '#dc2626', borderColor: '#fca5a5', fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                        onClick={() => setDeletingPaymentId(p.id)}
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
                {payments.length > 0 && (
                  <tr style={{ background: '#faf8f5' }}>
                    <td colSpan={2} style={{ fontWeight: 700 }}>{t('salary.net_paid')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: netPaid >= 0 ? '#1c1917' : '#dc2626' }}>
                      {fmtAmt(netPaid)}
                    </td>
                    <td></td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Pay Remaining confirmation dialog */}
      {showPayConfirm && selectedEmp && remaining && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <div className="confirm-modal-header">
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>{t('salary.pay_remaining')}</span>
            </div>

            <p style={{ margin: '0.5rem 0 1.25rem', color: '#57534e', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {t('salary.pay_remaining_confirm_msg')
                .replace('{name}', selectedEmp.name)
                .replace('{amount}', fmtAmt(remaining.remaining))}
            </p>

            <div style={{
              background: '#fff7ed',
              border: '1.5px solid #fdba74',
              borderRadius: 10,
              padding: '0.85rem 1rem',
              marginBottom: '1.25rem',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '0.75rem',
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#78716c', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.2rem' }}>{t('salary.cycle_base')}</div>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{fmtAmt(remaining.base_salary)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#78716c', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.2rem' }}>{t('salary.cycle_deducted')}</div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#dc2626' }}>− {fmtAmt(remaining.total_deducted)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#78716c', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.2rem' }}>{t('salary.cycle_remaining')}</div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#15803d' }}>{fmtAmt(remaining.remaining)}</div>
              </div>
            </div>

            {payMsg && <p style={{ fontSize: '0.82rem', color: '#dc2626', marginBottom: '0.75rem' }}>{payMsg}</p>}

            <div className="confirm-actions">
              <button
                className="btn-primary"
                disabled={payingRemaining}
                onClick={async () => {
                  await doPayRemaining()
                  setShowPayConfirm(false)
                }}
              >
                {payingRemaining ? t('common.saving') : t('salary.confirm_pay')}
              </button>
              <button
                className="btn-ghost"
                disabled={payingRemaining}
                onClick={() => { setShowPayConfirm(false); setPayMsg('') }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingPaymentId !== null && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <div className="confirm-modal-header">
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>{t('common.delete')} {t('salary.history')}</span>
            </div>
            <p style={{ margin: '0.5rem 0 1.5rem', color: '#57534e', fontSize: '0.9rem' }}>
              {t('common.delete_confirm')}
            </p>
            {deletePaymentError && <p className="form-error" style={{ marginBottom: '0.75rem' }}>{deletePaymentError}</p>}
            <div className="confirm-actions">
              <button
                className="btn-danger"
                disabled={deletePaymentSaving}
                onClick={confirmDeletePayment}
              >
                {deletePaymentSaving ? t('common.saving') : t('common.delete')}
              </button>
              <button
                className="btn-ghost"
                disabled={deletePaymentSaving}
                onClick={() => { setDeletingPaymentId(null); setDeletePaymentError('') }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

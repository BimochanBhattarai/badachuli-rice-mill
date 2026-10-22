import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { writeAuditLog } from '../audit'
import {
  getExpenseCategories,
  createExpenseCategory,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../../repository/expense.repo'
import { createLoan, getLoansByCustomer, getAllLoans } from '../../repository/loan.repo'
import {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  recordSalaryPayment,
  deleteSalaryPayment,
  getSalaryPayments,
  getEmployeeLoans,
  createEmployeeLoan,
  updateEmployeeLoan,
  recordLoanRepayment,
  getEmployeeRemaining,
  payRemainingSalary,
} from '../../repository/employee.repo'
import type { IpcResult } from '../../shared/types/api'
import type { ExpenseCategoryRow, ExpenseRow } from '../../repository/expense.repo'
import type { CustomerLoanRow } from '../../repository/loan.repo'
import type { EmployeeRow, SalaryPaymentRow, EmployeeLoanRow, EmployeeRemaining } from '../../repository/employee.repo'

export function registerFinanceHandlers(db: Database.Database): void {
  // ── Expense categories ───────────────────────────────────────────────────
  ipcMain.handle('expenses:getCategories', (): IpcResult<ExpenseCategoryRow[]> => {
    try {
      return { ok: true, data: getExpenseCategories(db) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'expenses:createCategory',
    (_e, name: string, operatorId: number): IpcResult<{ id: number }> => {
      try {
        if (!name?.trim()) return { ok: false, error: 'Category name is required' }
        const id = createExpenseCategory(db, name.trim())
        writeAuditLog(db, 'EXPENSE_CATEGORY_CREATED', 'expense_categories', id, { name }, operatorId)
        return { ok: true, data: { id } }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  // ── Expenses ─────────────────────────────────────────────────────────────
  ipcMain.handle(
    'expenses:getAll',
    (_e, fromDate?: string, toDate?: string): IpcResult<ExpenseRow[]> => {
      try {
        return { ok: true, data: getExpenses(db, fromDate, toDate) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'expenses:create',
    (
      _e,
      categoryId: number,
      amount: number,
      operatorId: number,
      description?: string,
      expenseDate?: string
    ): IpcResult<{ id: number }> => {
      try {
        if (!categoryId || amount <= 0) return { ok: false, error: 'Invalid category or amount' }
        const id = createExpense(db, categoryId, amount, operatorId, description, expenseDate)
        writeAuditLog(db, 'EXPENSE_CREATED', 'expenses', id, { categoryId, amount }, operatorId)
        return { ok: true, data: { id } }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'expenses:update',
    (
      _e,
      id: number,
      categoryId: number,
      amount: number,
      description: string | null,
      expenseDate: string,
      operatorId: number
    ): IpcResult => {
      try {
        if (!categoryId || amount <= 0) return { ok: false, error: 'Invalid category or amount' }
        updateExpense(db, id, categoryId, amount, description, expenseDate)
        writeAuditLog(db, 'EXPENSE_UPDATED', 'expenses', id, { categoryId, amount }, operatorId)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'expenses:delete',
    (_e, id: number, operatorId: number): IpcResult => {
      try {
        deleteExpense(db, id)
        writeAuditLog(db, 'EXPENSE_DELETED', 'expenses', id, null, operatorId)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  // ── Customer loans ────────────────────────────────────────────────────────
  ipcMain.handle(
    'loans:getByCustomer',
    (_e, customerId: number): IpcResult<CustomerLoanRow[]> => {
      try {
        return { ok: true, data: getLoansByCustomer(db, customerId) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle('loans:getAll', (): IpcResult<CustomerLoanRow[]> => {
    try {
      return { ok: true, data: getAllLoans(db) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'loans:create',
    (
      _e,
      customerId: number,
      amount: number,
      operatorId: number,
      description?: string,
      loanDate?: string
    ): IpcResult<{ id: number }> => {
      try {
        if (!customerId || amount <= 0) return { ok: false, error: 'Invalid customer or amount' }
        const id = createLoan(db, customerId, amount, operatorId, description, loanDate)
        writeAuditLog(db, 'LOAN_CREATED', 'customer_loans', id, { customerId, amount }, operatorId)
        return { ok: true, data: { id } }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  // ── Employees ─────────────────────────────────────────────────────────────
  ipcMain.handle(
    'salary:getEmployees',
    (_e, activeOnly?: boolean): IpcResult<EmployeeRow[]> => {
      try {
        return { ok: true, data: getAllEmployees(db, activeOnly ?? true) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'salary:createEmployee',
    (
      _e,
      name: string,
      phone: string | undefined,
      position: string | undefined,
      operatorId: number,
      baseSalary?: number
    ): IpcResult<{ id: number }> => {
      try {
        if (!name?.trim()) return { ok: false, error: 'Employee name is required' }
        const id = createEmployee(db, name.trim(), phone, position, baseSalary ?? 0)
        writeAuditLog(db, 'EMPLOYEE_CREATED', 'employees', id, { name, position, baseSalary }, operatorId)
        return { ok: true, data: { id } }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'salary:updateEmployee',
    (
      _e,
      id: number,
      name: string,
      phone: string | undefined,
      position: string | undefined,
      operatorId: number,
      baseSalary?: number
    ): IpcResult => {
      try {
        if (!name?.trim()) return { ok: false, error: 'Employee name is required' }
        updateEmployee(db, id, name.trim(), phone, position, baseSalary)
        writeAuditLog(db, 'EMPLOYEE_UPDATED', 'employees', id, { name, baseSalary }, operatorId)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'salary:deactivateEmployee',
    (_e, id: number, operatorId: number): IpcResult => {
      try {
        deactivateEmployee(db, id)
        writeAuditLog(db, 'EMPLOYEE_DEACTIVATED', 'employees', id, null, operatorId)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'salary:getPayments',
    (_e, employeeId: number): IpcResult<SalaryPaymentRow[]> => {
      try {
        return { ok: true, data: getSalaryPayments(db, employeeId) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'salary:recordPayment',
    (
      _e,
      employeeId: number,
      amount: number,
      txnType: string,
      operatorId: number,
      description?: string,
      paidDate?: string
    ): IpcResult<{ id: number }> => {
      try {
        if (!employeeId || amount <= 0) return { ok: false, error: 'Invalid employee or amount' }
        const validTypes = ['salary', 'advance', 'bonus', 'deduction']
        if (!validTypes.includes(txnType)) return { ok: false, error: 'Invalid transaction type' }
        const id = recordSalaryPayment(
          db,
          employeeId,
          amount,
          txnType as 'salary' | 'advance' | 'bonus' | 'deduction',
          operatorId,
          description,
          paidDate
        )
        writeAuditLog(db, 'SALARY_PAID', 'salary_payments', id, { employeeId, amount, txnType }, operatorId)
        return { ok: true, data: { id } }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'salary:deletePayment',
    (_e, id: number, operatorId: number): IpcResult => {
      try {
        deleteSalaryPayment(db, id)
        writeAuditLog(db, 'SALARY_PAYMENT_DELETED', 'salary_payments', id, { id }, operatorId)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  // ── Employee loans ────────────────────────────────────────────────────────
  ipcMain.handle(
    'salary:getEmployeeLoans',
    (_e, employeeId: number): IpcResult<EmployeeLoanRow[]> => {
      try {
        return { ok: true, data: getEmployeeLoans(db, employeeId) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'salary:createEmployeeLoan',
    (
      _e,
      employeeId: number,
      amount: number,
      operatorId: number,
      description?: string,
      loanDate?: string
    ): IpcResult<{ id: number }> => {
      try {
        if (!employeeId || amount <= 0) return { ok: false, error: 'Invalid employee or amount' }
        const id = createEmployeeLoan(db, employeeId, amount, operatorId, description, loanDate)
        writeAuditLog(db, 'EMPLOYEE_LOAN_CREATED', 'employee_loans', id, { employeeId, amount }, operatorId)
        return { ok: true, data: { id } }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'salary:updateEmployeeLoan',
    (
      _e,
      loanId: number,
      employeeId: number,
      amount: number,
      operatorId: number,
      description?: string,
      loanDate?: string
    ): IpcResult => {
      try {
        if (!loanId || !employeeId || amount <= 0) return { ok: false, error: 'Invalid loan or amount' }
        updateEmployeeLoan(db, loanId, employeeId, amount, operatorId, description, loanDate)
        writeAuditLog(db, 'EMPLOYEE_LOAN_UPDATED', 'employee_loans', loanId, { employeeId, amount }, operatorId)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'salary:recordLoanRepayment',
    (
      _e,
      loanId: number,
      employeeId: number,
      amount: number,
      operatorId: number,
      paidDate?: string
    ): IpcResult => {
      try {
        if (!loanId || !employeeId || amount <= 0) return { ok: false, error: 'Invalid loan or amount' }
        recordLoanRepayment(db, loanId, employeeId, amount, operatorId, paidDate)
        writeAuditLog(db, 'EMPLOYEE_LOAN_REPAYMENT', 'employee_loan_payments', null, { loanId, employeeId, amount }, operatorId)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  // ── Salary remaining & pay ────────────────────────────────────────────────
  ipcMain.handle(
    'salary:getRemaining',
    (_e, employeeId: number): IpcResult<EmployeeRemaining> => {
      try {
        return { ok: true, data: getEmployeeRemaining(db, employeeId) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'salary:payRemaining',
    (_e, employeeId: number, operatorId: number): IpcResult<{ paid: number }> => {
      try {
        if (!employeeId) return { ok: false, error: 'Invalid employee' }
        const result = payRemainingSalary(db, employeeId, operatorId)
        writeAuditLog(db, 'SALARY_PAID', 'salary_payments', null, { employeeId, paid: result.paid }, operatorId)
        return { ok: true, data: result }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )
}

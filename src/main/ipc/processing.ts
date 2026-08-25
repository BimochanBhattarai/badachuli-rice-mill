import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import {
  getAllRules,
  createRule,
  deactivateRule,
  runBatch,
  getRecentBatches,
} from '../../repository/processing.repo'
import type { IpcResult } from '../../shared/types/api'
import type {
  ProcessingRuleWithDetail,
  BatchWithRule,
  RunBatchInput,
} from '../../repository/processing.repo'

export function registerProcessingHandlers(db: Database.Database): void {
  ipcMain.handle('processing:getRules', (): IpcResult<ProcessingRuleWithDetail[]> => {
    try {
      return { ok: true, data: getAllRules(db) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'processing:createRule',
    (
      _e,
      name: string,
      inputItemId: number,
      inputVariantId: number | null,
      inputUnitId: number,
      outputs: { outputItemId: number; outputVariantId: number | null; outputUnitId: number; yieldPct: number }[],
      notes?: string
    ): IpcResult<{ id: number }> => {
      try {
        if (!name.trim()) return { ok: false, error: 'Rule name is required' }
        if (!outputs.length) return { ok: false, error: 'At least one output is required' }
        const id = createRule(db, name, inputItemId, inputVariantId, inputUnitId, outputs, notes)
        return { ok: true, data: { id } }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle('processing:deactivateRule', (_e, id: number): IpcResult => {
    try {
      deactivateRule(db, id)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('processing:runBatch', (_e, input: RunBatchInput): IpcResult<{ batchId: number }> => {
    try {
      if (!input.ruleId) return { ok: false, error: 'Rule is required' }
      if (!input.inputQty || input.inputQty <= 0) return { ok: false, error: 'Input quantity must be > 0' }
      if (!input.outputs?.length) return { ok: false, error: 'No outputs defined' }
      const result = runBatch(db, input)
      return { ok: true, data: result }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('processing:getRecentBatches', (_e, limit?: number): IpcResult<BatchWithRule[]> => {
    try {
      return { ok: true, data: getRecentBatches(db, limit) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
}

import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import {
  getAllItems,
  getItemById,
  searchItems,
  createItem,
  updateItem,
  deactivateItem,
} from '../../repository/item.repo'
import {
  getVariantsByItem,
  getVariantById,
  createVariant,
  updateVariant,
  deactivateVariant,
  ensureDefaultVariant,
} from '../../repository/variant.repo'
import type { IpcResult } from '../../shared/types/api'
import type { ItemRow, ItemWithUnit } from '../../repository/item.repo'
import type { VariantRow } from '../../repository/variant.repo'

export function registerItemHandlers(db: Database.Database): void {
  ipcMain.handle(
    'items:getAll',
    (_e, activeOnly = true): IpcResult<ItemWithUnit[]> => {
      try {
        return { ok: true, data: getAllItems(db, activeOnly) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle('items:getById', (_e, id: number): IpcResult<ItemWithUnit> => {
    try {
      const item = getItemById(db, id)
      if (!item) return { ok: false, error: 'Item not found' }
      return { ok: true, data: item }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'items:search',
    (_e, query: string, category?: string): IpcResult<ItemWithUnit[]> => {
      try {
        return { ok: true, data: searchItems(db, query ?? '', category) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'items:create',
    (
      _e,
      name: string,
      category: ItemRow['category'],
      defaultUnitId: number
    ): IpcResult<{ id: number; variantId: number }> => {
      try {
        if (!name?.trim()) return { ok: false, error: 'Item name is required' }
        const validCategories = ['raw_material', 'finished', 'byproduct', 'consumable']
        if (!validCategories.includes(category))
          return { ok: false, error: 'Invalid category' }

        const itemId = db.transaction(() => {
          const id = createItem(db, name.trim(), category, defaultUnitId)
          // auto-create a default variant with the same name
          createVariant(db, id, name.trim(), true)
          return id
        })()

        const variants = getVariantsByItem(db, itemId)
        return { ok: true, data: { id: itemId, variantId: variants[0].id } }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('UNIQUE')) return { ok: false, error: 'An item with that name already exists' }
        return { ok: false, error: msg }
      }
    }
  )

  ipcMain.handle(
    'items:update',
    (_e, id: number, name: string, category: ItemRow['category'], defaultUnitId: number): IpcResult => {
      try {
        if (!name?.trim()) return { ok: false, error: 'Item name is required' }
        updateItem(db, id, name.trim(), category, defaultUnitId)
        return { ok: true }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('UNIQUE')) return { ok: false, error: 'An item with that name already exists' }
        return { ok: false, error: msg }
      }
    }
  )

  ipcMain.handle('items:deactivate', (_e, id: number): IpcResult => {
    try {
      deactivateItem(db, id)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  // ── Variant sub-handlers ──────────────────────────────────────

  ipcMain.handle('variants:getByItem', (_e, itemId: number): IpcResult<VariantRow[]> => {
    try {
      return { ok: true, data: getVariantsByItem(db, itemId) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('variants:getById', (_e, id: number): IpcResult<VariantRow> => {
    try {
      const v = getVariantById(db, id)
      if (!v) return { ok: false, error: 'Variant not found' }
      return { ok: true, data: v }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'variants:create',
    (_e, itemId: number, name: string, isDefault: boolean): IpcResult<{ id: number }> => {
      try {
        if (!name?.trim()) return { ok: false, error: 'Variant name is required' }
        const id = createVariant(db, itemId, name.trim(), isDefault)
        return { ok: true, data: { id } }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('UNIQUE')) return { ok: false, error: 'A variant with that name already exists for this item' }
        return { ok: false, error: msg }
      }
    }
  )

  ipcMain.handle(
    'variants:update',
    (_e, id: number, name: string, isDefault: boolean): IpcResult => {
      try {
        if (!name?.trim()) return { ok: false, error: 'Variant name is required' }
        updateVariant(db, id, name.trim(), isDefault)
        return { ok: true }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('UNIQUE')) return { ok: false, error: 'A variant with that name already exists for this item' }
        return { ok: false, error: msg }
      }
    }
  )

  ipcMain.handle('variants:deactivate', (_e, id: number): IpcResult => {
    try {
      const v = getVariantById(db, id)
      if (!v) return { ok: false, error: 'Variant not found' }
      deactivateVariant(db, id)
      ensureDefaultVariant(db, v.item_id)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
}

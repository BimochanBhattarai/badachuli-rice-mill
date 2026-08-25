import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import {
  getCurrentPrices,
  getPriceHistory,
  setPrice,
} from '../../repository/price.repo'
import type { IpcResult } from '../../shared/types/api'
import type { CurrentPrice, PriceRow } from '../../repository/price.repo'

export function registerPriceHandlers(db: Database.Database): void {
  ipcMain.handle('prices:getCurrent', (_e, itemId: number): IpcResult<CurrentPrice[]> => {
    try {
      return { ok: true, data: getCurrentPrices(db, itemId) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'prices:getHistory',
    (
      _e,
      itemId: number,
      variantId: number | null,
      priceType: 'sell' | 'buy'
    ): IpcResult<PriceRow[]> => {
      try {
        return { ok: true, data: getPriceHistory(db, itemId, variantId, priceType) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'prices:set',
    (
      _e,
      itemId: number,
      variantId: number | null,
      unitId: number,
      price: number,
      priceType: 'sell' | 'buy',
      effectiveFrom: string
    ): IpcResult<{ id: number }> => {
      try {
        if (price < 0) return { ok: false, error: 'Price cannot be negative' }
        if (!itemId) return { ok: false, error: 'Item is required' }
        if (!unitId) return { ok: false, error: 'Unit is required' }
        if (!['sell', 'buy'].includes(priceType))
          return { ok: false, error: 'Invalid price type' }
        const id = setPrice(db, itemId, variantId, unitId, price, priceType, effectiveFrom)
        return { ok: true, data: { id } }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )
}

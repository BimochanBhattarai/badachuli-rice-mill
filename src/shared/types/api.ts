export interface IpcResult<T = null> {
  ok: boolean
  data?: T
  error?: string
}

export interface AuthUser {
  id: number
  username: string
  role: string
}

export interface UnitRow {
  id: number
  name: string
  abbreviation: string
  base_factor: number
  is_default: number
}

export interface ItemRow {
  id: number
  name: string
  category: 'raw_material' | 'finished' | 'byproduct' | 'consumable'
  default_unit_id: number
  is_active: number
  created_at: string
  unit_name: string
  unit_abbreviation: string
}

export interface VariantRow {
  id: number
  item_id: number
  name: string
  is_default: number
  is_active: number
}

export interface PriceRow {
  id: number
  item_id: number
  variant_id: number | null
  unit_id: number
  price: number
  price_type: 'sell' | 'buy'
  effective_from: string
  effective_to: string | null
  created_at: string
}

export interface CurrentPrice extends PriceRow {
  item_name: string
  variant_name: string | null
  unit_abbreviation: string
}

export interface ElectronAPI {
  ping: () => Promise<string>

  auth: {
    isFirstRun: () => Promise<IpcResult<boolean>>
    setupOwner: (username: string, pin: string) => Promise<IpcResult<{ userId: number }>>
    login: (username: string, pin: string) => Promise<IpcResult<AuthUser>>
    changePin: (userId: number, currentPin: string, newPin: string) => Promise<IpcResult>
  }

  settings: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<boolean>
  }

  units: {
    getAll: () => Promise<IpcResult<UnitRow[]>>
    getById: (id: number) => Promise<IpcResult<UnitRow>>
    create: (name: string, abbreviation: string, baseFactor: number) => Promise<IpcResult<{ id: number }>>
    update: (id: number, name: string, abbreviation: string, baseFactor: number) => Promise<IpcResult>
    delete: (id: number) => Promise<IpcResult>
    getDefault: () => Promise<IpcResult<UnitRow>>
    setDefault: (id: number) => Promise<IpcResult>
  }

  items: {
    getAll: (activeOnly?: boolean) => Promise<IpcResult<ItemRow[]>>
    getById: (id: number) => Promise<IpcResult<ItemRow>>
    search: (query: string, category?: string) => Promise<IpcResult<ItemRow[]>>
    create: (
      name: string,
      category: ItemRow['category'],
      defaultUnitId: number
    ) => Promise<IpcResult<{ id: number; variantId: number }>>
    update: (
      id: number,
      name: string,
      category: ItemRow['category'],
      defaultUnitId: number
    ) => Promise<IpcResult>
    deactivate: (id: number) => Promise<IpcResult>
  }

  variants: {
    getByItem: (itemId: number) => Promise<IpcResult<VariantRow[]>>
    getById: (id: number) => Promise<IpcResult<VariantRow>>
    create: (itemId: number, name: string, isDefault: boolean) => Promise<IpcResult<{ id: number }>>
    update: (id: number, name: string, isDefault: boolean) => Promise<IpcResult>
    deactivate: (id: number) => Promise<IpcResult>
  }

  prices: {
    getCurrent: (itemId: number) => Promise<IpcResult<CurrentPrice[]>>
    getHistory: (
      itemId: number,
      variantId: number | null,
      priceType: 'sell' | 'buy'
    ) => Promise<IpcResult<PriceRow[]>>
    set: (
      itemId: number,
      variantId: number | null,
      unitId: number,
      price: number,
      priceType: 'sell' | 'buy',
      effectiveFrom: string
    ) => Promise<IpcResult<{ id: number }>>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

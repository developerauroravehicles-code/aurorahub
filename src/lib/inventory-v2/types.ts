export type InventoryLocationType = 'national' | 'province' | 'city' | 'region' | 'dealer' | 'specialist'

export type InventoryMovementType =
  | 'receipt'
  | 'allocation'
  | 'transfer'
  | 'consumption'
  | 'adjustment'
  | 'return'

export type PricingScopeType = 'national' | 'province' | 'city' | 'region' | 'dealer'

export type InventoryServiceType = 'installation' | 'transfer' | 'removal'

export type InventoryLocation = {
  id: string
  location_type: InventoryLocationType
  province_id: string | null
  city_id: string | null
  region_id: string | null
  dealer_id: string | null
  specialist_profile_id: string | null
  label: string
}

export type InventoryCity = {
  id: string
  province_id: string
  code: string
  name: string
}

export type InventoryRegion = {
  id: string
  city_id: string
  province_id: string
  code: string
  name: string
}

export type InventoryBalanceRow = {
  location_id: string
  location_type: InventoryLocationType
  label: string
  camera_model_id: string
  quantity: number
}

export type InventoryPricingRule = {
  id: string
  scope_type: PricingScopeType
  scope_id: string | null
  camera_model_id: string | null
  service_type: InventoryServiceType
  price_cad: number
}

export type DealerInventoryContext = {
  dealerId: string
  dealerLocationId: string | null
  inventoryRegionId: string | null
  inventoryCityId: string | null
  inventoryProvinceId: string | null
}

export type InventoryTreeLevel =
  | 'national'
  | 'province'
  | 'city'
  | 'region'
  | 'dealer'

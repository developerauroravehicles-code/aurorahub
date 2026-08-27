/**
 * Barcode settings — stored in system_settings.barcode_settings
 */

export interface BarcodeSettings {
  enabled: boolean
  codePrefix: string
}

export const DEFAULT_BARCODE_SETTINGS: BarcodeSettings = {
  enabled: false,
  codePrefix: 'AUR',
}

export const BARCODE_SETTINGS_KEY = 'barcode_settings'

export type BarcodeKind = 'unit' | 'set'

export type BarcodeStatus =
  | 'generated'
  | 'at_dealer'
  | 'at_specialist'
  | 'consumed'
  | 'void'

export type BarcodeEventType =
  | 'generated'
  | 'assigned_dealer'
  | 'assigned_specialist'
  | 'consumed'
  | 'void'

export interface InventoryBarcodeRow {
  id: string
  code: string
  kind: BarcodeKind
  camera_model_id: string | null
  set_template_id: string | null
  parent_barcode_id: string | null
  batch_id: string
  status: BarcodeStatus
  dealer_id: string | null
  specialist_id: string | null
  inventory_location_id: string | null
  demand_id: string | null
  consumed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BarcodeSetTemplateRow {
  id: string
  name: string
  code: string
  description: string | null
  created_at: string
  items?: BarcodeSetTemplateItemRow[]
}

export interface BarcodeSetTemplateItemRow {
  id: string
  template_id: string
  camera_model_id: string
  quantity: number
  camera_models?: { name: string } | null
}

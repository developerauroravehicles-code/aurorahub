export type PortalTroubleshootingItem = {
  title: string
  body: string
}

/** Row returned by `customer_portal_lookup_by_vin` / `lookup_by_phone` RPC (public portal). */
export type CustomerPortalRow = {
  demand_number: string | null
  status: string
  appointment_date: string | null
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  dealer_name: string
  dealer_warranty_years?: number
  camera_model: string
  warranty_end: string | null
  sd_card_warranty_end?: string | null
  camera_image_url?: string
  camera_manual_url?: string
  camera_troubleshooting?: PortalTroubleshootingItem[] | null
  specialist_name: string
  rated_customer_rating: number | null
  rated_quality_score: number | null
  can_rate: boolean
  customer_firstname: string
  customer_address: string
  service_type: string
  completed_at: string | null
  dealer_address: string
  dealer_phone: string
  dealer_timezone: string
  rated_comment: string
  stock_number: string
  vin_last6?: string
}

export type PortalContactInfo = {
  phone: string
  email: string
  hours: string
}

export type PortalLookupResult =
  | { ok: true; rows: CustomerPortalRow[] }
  | { ok: false; error: string; rows: [] }
  | { ok: true; rows: []; empty: true }

/** Row returned by `customer_portal_lookup_by_vin` RPC (public portal). */
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
}

export type PortalLookupResult =
  | { ok: true; rows: CustomerPortalRow[] }
  | { ok: false; error: string; rows: [] }
  | { ok: true; rows: []; empty: true }

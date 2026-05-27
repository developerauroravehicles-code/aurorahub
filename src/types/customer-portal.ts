/** Row returned by `customer_portal_lookup_by_vin` RPC (public portal). */
export type CustomerPortalRow = {
  demand_number: string | null
  status: string
  appointment_date: string
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  dealer_name: string
  camera_model: string
  warranty_end: string | null
  specialist_name: string
  rated_customer_rating: number | null
  rated_quality_score: number | null
  can_rate: boolean
}

export type ServiceRecordStatus = 'pending_approval' | 'rejected' | 'scheduled'

export type ServiceRecordDiagnosisCode =
  | 'camera_not_recording'
  | 'sd_card_issue'
  | 'power_wiring_issue'
  | 'app_connectivity_issue'
  | 'display_monitor_issue'
  | 'other'

/** Row from customer_portal_service_records_by_vin RPC (public portal). */
export type PortalServiceRecordRow = {
  id: string
  demand_number: string
  status: ServiceRecordStatus
  diagnosis_code: ServiceRecordDiagnosisCode
  diagnosis_other: string
  comment: string
  rejection_reason: string
  service_appointment_at: string | null
  service_location: string
  created_at: string
}

/** Full row for Aurora Manager dashboard. */
export type CustomerServiceRecord = {
  id: string
  demand_id: string
  demand_number: string
  vin_last6: string
  customer_firstname: string
  customer_phone: string
  vehicle_summary: string
  dealer_name: string
  diagnosis_code: ServiceRecordDiagnosisCode
  diagnosis_other: string
  comment: string
  status: ServiceRecordStatus
  rejection_reason: string
  service_appointment_at: string | null
  service_location: string
  sms_sent_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

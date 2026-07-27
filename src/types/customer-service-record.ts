export type ServiceRecordStatus =
  | 'pending_approval'
  | 'rejected'
  | 'scheduled'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type ServiceRecordExpenseCategory = 'travel' | 'meals' | 'other'
export type ServiceRecordExpenseStatus = 'pending' | 'approved' | 'rejected'

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
  assigned_specialist_id: string | null
  assigned_at: string | null
  completed_at: string | null
  completed_by: string | null
  completion_notes: string
  service_fee_amount: number
  compensation_recorded_at: string | null
  created_at: string
  updated_at: string
}

export type ServiceRecordExpense = {
  id: string
  service_record_id: string
  description: string
  amount: number
  category: ServiceRecordExpenseCategory
  submitted_by: string | null
  status: ServiceRecordExpenseStatus
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string
  payroll_recorded_at: string | null
  created_at: string
  updated_at: string
}

export type SpecialistOption = {
  id: string
  full_name: string
}

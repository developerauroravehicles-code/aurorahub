export type ComplianceDocCategory = 'onboarding' | 'offboarding'

export type ComplianceInteractionType = 'upload' | 'acknowledge' | 'docusign' | 'hr_generated'

export type PersonnelDocumentStatus =
  | 'assigned'
  | 'generated'
  | 'pending_ack'
  | 'acknowledged'
  | 'pending_signature'
  | 'signed'
  | 'uploaded'
  | 'verified'
  | 'cancelled'

export type ComplianceDocumentEventType =
  | 'generated'
  | 'viewed'
  | 'scroll_completed'
  | 'acknowledged'
  | 'uploaded'
  | 'docusign_sent'
  | 'docusign_signed'
  | 'hr_verified'
  | 'cancelled'

export type ComplianceDocumentTemplate = {
  id: string
  code: string
  name: string
  description: string | null
  category: ComplianceDocCategory
  interaction_type: ComplianceInteractionType
  province: string | null
  template_version: number
  template_drive_file_id: string | null
  template_body: string | null
  requires_scroll_ack: boolean
  sort_order: number
  is_active: boolean
}

export type PersonnelDocumentAssignment = {
  id: string
  personnel_id: string
  template_id: string
  template_version: number
  status: PersonnelDocumentStatus
  drive_file_id: string | null
  drive_web_view_link: string | null
  drive_folder_path: string | null
  content_hash: string | null
  acknowledged_at: string | null
  acknowledged_ip: string | null
  ack_user_agent: string | null
  scroll_completed_at: string | null
  docusign_envelope_id: string | null
  docusign_status: string | null
  signed_at: string | null
  signed_drive_file_id: string | null
  assigned_by: string | null
  assigned_at: string
  due_date: string | null
  verified_at: string | null
  verified_by: string | null
  metadata: Record<string, unknown>
  template?: ComplianceDocumentTemplate | null
}

export const DOCUMENT_STATUS_LABELS: Record<PersonnelDocumentStatus, string> = {
  assigned: 'Assigned',
  generated: 'Generated',
  pending_ack: 'Pending acknowledgment',
  acknowledged: 'Acknowledged',
  pending_signature: 'Pending signature',
  signed: 'Signed',
  uploaded: 'Uploaded',
  verified: 'Verified',
  cancelled: 'Cancelled',
}

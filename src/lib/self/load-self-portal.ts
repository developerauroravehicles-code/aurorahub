import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchSpecialistCompensationSnapshot } from '@/lib/specialist-compensation-snapshot'
import { fetchMyFieldCameraStock } from '@/lib/inventory-v2/specialist-stock'
import { fetchOrgDepartmentTree, orgRoleLabel } from '@/lib/hr-org-structure'
import type { SpecialistCompensationSnapshot } from '@/lib/specialist-compensation'
import type { SpecialistExpenseClaim } from '@/lib/specialist-expense-claims'
import { getMyExpenseClaimsCore } from './expenses'

function normEquipmentTypes(e: unknown): { name: string } | null {
  if (!e) return null
  const arr = Array.isArray(e) ? e : [e]
  const first = arr[0] as { name?: string } | undefined
  return first ? { name: first.name ?? '' } : null
}

export type SelfPortalProfile = {
  id: string
  full_name: string | null
  phone: string | null
  role: string
  dealer_id: string | null
}

export type SelfPortalPersonnel = {
  id: string
  full_name?: string | null
  phone?: string | null
  email?: string | null
  position?: string | null
  status?: string | null
  start_date?: string | null
  province?: string | null
  platform_role?: string | null
  salary_amount?: number | null
  salary_type?: string | null
  salary_currency?: string | null
  salary_pay_schedule?: string | null
  department_id?: string | null
  org_role_id?: string | null
}

export type SelfDocumentAssignment = {
  id: string
  personnel_id: string
  status: string
  drive_file_id: string | null
  drive_web_view_link: string | null
  signed_drive_file_id: string | null
  acknowledged_at: string | null
  scroll_completed_at: string | null
  signed_at: string | null
  verified_at: string | null
  docusign_envelope_id: string | null
  docusign_status: string | null
  template: {
    code: string
    name: string
    category: string
    interaction_type: string
    requires_scroll_ack: boolean
    description: string | null
  } | null
}

export type SelfPortalData = {
  profile: SelfPortalProfile
  personnel: SelfPortalPersonnel | null
  orgDisplay: { mainDepartment: string; subDepartment: string; jobTitle: string } | null
  leaveRequests: { id: string; leave_type: string; start_date: string; end_date: string; status: string; notes?: string | null }[]
  payments: { id: string; amount: number; period_start: string | null; period_end: string | null; status: string; paid_at: string | null; payment_type: string | null; completed_count?: number | null }[]
  payEstimate: SpecialistCompensationSnapshot | null
  expenseClaims: SpecialistExpenseClaim[]
  cameraStock: { camera_model_id: string; model_name: string; quantity: number }[]
  equipment: { id: string; item_name?: string | null; serial_number?: string | null; assigned_at: string; condition?: string | null; equipment_types?: { name: string } | null }[]
  certifications: { id: string; certification_type: string; name?: string | null; institution?: string | null; issue_date: string; expiry_date: string | null; status?: string | null }[]
  complianceDocuments: { id: string; document_type: string | null; title: string | null; expiry_date: string | null; verified_at: string | null; document_url: string | null }[]
  complianceChecklists: { id: string; item_name: string; completed: boolean; completed_at: string | null; notes: string | null }[]
  documentAssignments: SelfDocumentAssignment[]
  availability: { id: string; day_of_week: number; start_time: string; end_time: string; is_available: boolean }[]
  feedback: { id: string; feedback_type: string | null; source: string | null; rating: number | null; comment: string | null; created_at: string }[]
  leaveBlocks: { id: string; start_date: string; end_date: string; reason?: string | null }[]
  onboardingTasks: { id: string; title: string; status: string; due_date: string | null; completed_at: string | null }[]
}

/**
 * Loads everything the Self Portal shows for `userId`, using a client that acts
 * as that user (cookie session on web, Bearer token in the field app) so RLS applies.
 * Callers must first check the profile exists and is not a dealer user.
 */
export async function loadSelfPortalData(
  supabase: SupabaseClient,
  profile: SelfPortalProfile
): Promise<SelfPortalData> {
  const userId = profile.id

  const { data: personnel } = await supabase
    .from('personnel')
    .select(`
      id, full_name, phone, email, position, status, start_date, province, platform_role,
      salary_amount, salary_type, salary_currency, salary_pay_schedule,
      department_id, org_role_id,
      hr_departments(name, parent_id),
      hr_org_roles(name)
    `)
    .eq('profile_id', userId)
    .single()

  const orgTree = await fetchOrgDepartmentTree(supabase)
  const orgDisplay = personnel ? orgRoleLabel(personnel, orgTree) : null

  const personnelId = personnel?.id

  const [
    leaveRes,
    paymentsRes,
    equipmentRes,
    certsRes,
    complianceDocsRes,
    complianceChecklistsRes,
    documentAssignmentsRes,
    availabilityRes,
    feedbackRes,
    leaveBlocksRes,
    onboardingRes,
  ] = await Promise.all([
    supabase.from('leave_requests').select('id, leave_type, start_date, end_date, status, notes').eq('profile_id', userId).order('start_date', { ascending: false }),
    personnelId ? supabase.from('payment_records').select('id, amount, period_start, period_end, status, paid_at, payment_type, completed_count').eq('personnel_id', personnelId).order('period_start', { ascending: false }).limit(24) : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('equipment_assignments').select('id, item_name, serial_number, assigned_at, returned_at, condition, equipment_types(name)').eq('personnel_id', personnelId).is('returned_at', null) : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('personnel_certifications').select('id, certification_type, name, institution, issue_date, expiry_date, status').eq('personnel_id', personnelId).order('expiry_date', { ascending: false }) : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('compliance_documents').select('id, document_type, title, expiry_date, verified_at, document_url').eq('personnel_id', personnelId).order('expiry_date', { ascending: false }) : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('compliance_checklists').select('id, item_name, completed, completed_at, notes').eq('personnel_id', personnelId) : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('personnel_document_assignments').select(`
      id, personnel_id, status, drive_file_id, drive_web_view_link, signed_drive_file_id,
      acknowledged_at, scroll_completed_at, signed_at, verified_at,
      docusign_envelope_id, docusign_status,
      template:compliance_document_templates(code, name, category, interaction_type, requires_scroll_ack, description)
    `).eq('personnel_id', personnelId).order('assigned_at') : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('personnel_availability').select('id, day_of_week, start_time, end_time, is_available').eq('personnel_id', personnelId) : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('performance_feedback').select('id, feedback_type, source, rating, comment, created_at').eq('personnel_id', personnelId).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('personnel_leave_blocks').select('id, start_date, end_date, reason').eq('personnel_id', personnelId).order('start_date', { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from('onboarding_tasks').select('id, title, status, due_date, completed_at').eq('profile_id', userId).order('sort_order'),
  ])

  const equipment = ((equipmentRes.data ?? []) as Record<string, unknown>[]).map((e) => ({
    ...e,
    equipment_types: normEquipmentTypes(e.equipment_types),
  })) as SelfPortalData['equipment']

  const documentAssignments = ((documentAssignmentsRes.data ?? []) as Record<string, unknown>[]).map((a) => ({
    ...a,
    template: Array.isArray(a.template) ? (a.template[0] ?? null) : (a.template ?? null),
  })) as SelfDocumentAssignment[]

  const isSpecialist = profile.role === 'specialist'
  const payEstimate = isSpecialist ? await fetchSpecialistCompensationSnapshot(supabase, userId) : null
  const expenseClaims = isSpecialist ? await getMyExpenseClaimsCore(supabase, userId) : { claims: [] }
  const cameraStock = isSpecialist ? await fetchMyFieldCameraStock(supabase) : []

  return {
    profile,
    personnel: (personnel ?? null) as SelfPortalPersonnel | null,
    orgDisplay,
    leaveRequests: leaveRes.data ?? [],
    payments: (paymentsRes.data ?? []) as SelfPortalData['payments'],
    payEstimate,
    expenseClaims: 'claims' in expenseClaims ? (expenseClaims.claims ?? []) : [],
    cameraStock,
    equipment,
    certifications: (certsRes.data ?? []) as SelfPortalData['certifications'],
    complianceDocuments: (complianceDocsRes.data ?? []) as SelfPortalData['complianceDocuments'],
    complianceChecklists: (complianceChecklistsRes.data ?? []) as SelfPortalData['complianceChecklists'],
    documentAssignments,
    availability: (availabilityRes.data ?? []) as SelfPortalData['availability'],
    feedback: (feedbackRes.data ?? []) as SelfPortalData['feedback'],
    leaveBlocks: (leaveBlocksRes.data ?? []) as SelfPortalData['leaveBlocks'],
    onboardingTasks: (onboardingRes.data ?? []) as SelfPortalData['onboardingTasks'],
  }
}

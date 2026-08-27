import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SelfPortalContent } from './self-portal-content'
import { fetchSpecialistCompensationSnapshot } from '@/lib/specialist-compensation-snapshot'
import { fetchMyFieldCameraStock } from '@/lib/inventory-v2/specialist-stock'
import { getMyExpenseClaims } from './expense-actions'
import { fetchOrgDepartmentTree, orgRoleLabel } from '@/lib/hr-org-structure'

export const dynamic = 'force-dynamic'

function normEquipmentTypes(e: unknown): { name: string } | null {
  if (!e) return null
  const arr = Array.isArray(e) ? e : [e]
  const first = arr[0] as { name?: string } | undefined
  return first ? { name: first.name ?? '' } : null
}

export default async function SelfPortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, dealer_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')
  if (profile.dealer_id) redirect('/dashboard') // Dealers excluded - Self Portal is Platform only

  const { data: personnel } = await supabase
    .from('personnel')
    .select(`
      id, full_name, phone, email, position, status, start_date, province, platform_role,
      department_id, org_role_id,
      hr_departments(name, parent_id),
      hr_org_roles(name)
    `)
    .eq('profile_id', user.id)
    .single()

  const orgTree = await fetchOrgDepartmentTree(supabase)
  const orgDisplay = personnel ? orgRoleLabel(personnel, orgTree) : null

  const personnelId = personnel?.id

  type Payments = Parameters<typeof SelfPortalContent>[0]['payments']
  type Equipment = Parameters<typeof SelfPortalContent>[0]['equipment']

  const [
    leaveRes,
    paymentsRes,
    equipmentRes,
    certsRes,
    complianceDocsRes,
    complianceChecklistsRes,
    availabilityRes,
    feedbackRes,
    leaveBlocksRes,
    onboardingRes,
  ] = await Promise.all([
    supabase.from('leave_requests').select('id, leave_type, start_date, end_date, status, notes').eq('profile_id', user.id).order('start_date', { ascending: false }),
    personnelId ? supabase.from('payment_records').select('id, amount, period_start, period_end, status, paid_at, payment_type, completed_count').eq('personnel_id', personnelId).order('period_start', { ascending: false }).limit(24) : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('equipment_assignments').select('id, item_name, serial_number, assigned_at, returned_at, condition, equipment_types(name)').eq('personnel_id', personnelId).is('returned_at', null) : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('personnel_certifications').select('id, certification_type, name, institution, issue_date, expiry_date, status').eq('personnel_id', personnelId).order('expiry_date', { ascending: false }) : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('compliance_documents').select('id, document_type, title, expiry_date, verified_at, document_url').eq('personnel_id', personnelId).order('expiry_date', { ascending: false }) : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('compliance_checklists').select('id, item_name, completed, completed_at, notes').eq('personnel_id', personnelId) : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('personnel_availability').select('id, day_of_week, start_time, end_time, is_available').eq('personnel_id', personnelId) : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('performance_feedback').select('id, feedback_type, source, rating, comment, created_at').eq('personnel_id', personnelId).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    personnelId ? supabase.from('personnel_leave_blocks').select('id, start_date, end_date, reason').eq('personnel_id', personnelId).order('start_date', { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from('onboarding_tasks').select('id, title, status, due_date, completed_at').eq('profile_id', user.id).order('sort_order'),
  ])

  const normEquipment: Equipment = ((equipmentRes.data ?? []) as Record<string, unknown>[]).map((e) => ({
    ...e,
    equipment_types: normEquipmentTypes(e.equipment_types),
  })) as Equipment

  const payEstimate =
    profile.role === 'specialist'
      ? await fetchSpecialistCompensationSnapshot(supabase, user.id)
      : null

  const expenseClaimsResult =
    profile.role === 'specialist' ? await getMyExpenseClaims() : { claims: [] as never[] }

  const cameraStock =
    profile.role === 'specialist' ? await fetchMyFieldCameraStock(supabase) : []

  return (
    <div className="min-w-0 max-w-full space-y-8">
      <div>
        <h1 className="break-words text-xl font-semibold text-zinc-900 dark:text-white sm:text-2xl mb-2">Self Portal</h1>
        <p className="text-zinc-500 dark:text-gray-400">Your profile, leave, pay, IT support, documents, and more.</p>
      </div>
      <SelfPortalContent
        profile={profile}
        personnel={personnel}
        orgDisplay={orgDisplay}
        leaveRequests={leaveRes.data ?? []}
        payments={(paymentsRes.data ?? []) as Payments}
        payEstimate={payEstimate}
        expenseClaims={expenseClaimsResult.claims ?? []}
        cameraStock={cameraStock}
        equipment={normEquipment}
        certifications={(certsRes.data ?? []) as Parameters<typeof SelfPortalContent>[0]['certifications']}
        complianceDocuments={(complianceDocsRes.data ?? []) as Parameters<typeof SelfPortalContent>[0]['complianceDocuments']}
        complianceChecklists={(complianceChecklistsRes.data ?? []) as Parameters<typeof SelfPortalContent>[0]['complianceChecklists']}
        availability={(availabilityRes.data ?? []) as Parameters<typeof SelfPortalContent>[0]['availability']}
        feedback={(feedbackRes.data ?? []) as Parameters<typeof SelfPortalContent>[0]['feedback']}
        leaveBlocks={(leaveBlocksRes.data ?? []) as Parameters<typeof SelfPortalContent>[0]['leaveBlocks']}
        onboardingTasks={(onboardingRes.data ?? []) as Parameters<typeof SelfPortalContent>[0]['onboardingTasks']}
      />
    </div>
  )
}

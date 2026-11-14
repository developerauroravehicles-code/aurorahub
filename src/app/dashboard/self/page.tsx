import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SelfPortalContent } from './self-portal-content'
import { loadSelfPortalData } from '@/lib/self/load-self-portal'
import { getSelfPersonnelId } from '@/lib/self/documents'
import { preparePendingAssignmentsForPersonnel } from '@/app/dashboard/hr/compliance/document-pack-actions'

export const dynamic = 'force-dynamic'

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

  // Generate any assigned documents before listing them.
  const personnelId = await getSelfPersonnelId(supabase, user.id)
  if (personnelId) {
    await preparePendingAssignmentsForPersonnel(personnelId)
  }

  const data = await loadSelfPortalData(supabase, profile)

  return (
    <div className="min-w-0 max-w-full space-y-8">
      <div>
        <h1 className="break-words text-xl font-semibold text-zinc-900 dark:text-white sm:text-2xl mb-2">Self Portal</h1>
        <p className="text-zinc-500 dark:text-gray-400">Your profile, leave, pay, IT support, documents, and more.</p>
      </div>
      <SelfPortalContent
        profile={data.profile}
        personnel={data.personnel}
        orgDisplay={data.orgDisplay}
        leaveRequests={data.leaveRequests}
        payments={data.payments}
        payEstimate={data.payEstimate}
        expenseClaims={data.expenseClaims}
        cameraStock={data.cameraStock}
        equipment={data.equipment}
        certifications={data.certifications}
        complianceDocuments={data.complianceDocuments}
        complianceChecklists={data.complianceChecklists}
        documentAssignments={data.documentAssignments as unknown as Parameters<typeof SelfPortalContent>[0]['documentAssignments']}
        availability={data.availability}
        feedback={data.feedback}
        leaveBlocks={data.leaveBlocks}
        onboardingTasks={data.onboardingTasks}
      />
    </div>
  )
}

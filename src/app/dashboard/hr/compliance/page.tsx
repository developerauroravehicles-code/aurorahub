import { createClient } from '@/lib/supabase/server'
import { ComplianceContent } from './compliance-content'

export default async function CompliancePage() {
  const supabase = await createClient()
  const [docsRes, checklistsRes, personnelRes] = await Promise.all([
    supabase.from('compliance_documents').select('*, personnel(full_name)').order('created_at', { ascending: false }),
    supabase.from('compliance_checklists').select('*, personnel(full_name)').order('created_at', { ascending: false }),
    supabase.from('personnel').select('id, full_name').order('full_name'),
  ])
  const documents = docsRes.data ?? []
  const checklists = checklistsRes.data ?? []
  const personnel = personnelRes.data ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Compliance & Legal (Canada)</h1>
        <p className="text-gray-400">Employment compliance, provincial rules, insurance, safety, work permits, SIN, driver licenses.</p>
      </div>
      <ComplianceContent documents={documents} checklists={checklists} personnel={personnel} />
    </div>
  )
}

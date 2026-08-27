import { createClient } from '@/lib/supabase/server'
import { ComplianceContent } from './compliance-content'

export default async function CompliancePage() {
  const supabase = await createClient()
  const [docsRes, checklistsRes, personnelRes, templatesRes, assignmentsRes] = await Promise.all([
    supabase.from('compliance_documents').select('*, personnel(full_name)').order('created_at', { ascending: false }),
    supabase.from('compliance_checklists').select('*, personnel(full_name)').order('created_at', { ascending: false }),
    supabase.from('personnel').select('id, full_name').is('dealer_id', null).order('full_name'),
    supabase.from('compliance_document_templates').select('*').order('sort_order'),
    supabase.from('personnel_document_assignments').select(`
      id, personnel_id, status, drive_file_id, signed_drive_file_id, drive_web_view_link, docusign_envelope_id, docusign_status,
      template:compliance_document_templates(code, name, category, interaction_type),
      personnel:personnel(full_name)
    `).order('assigned_at', { ascending: false }),
  ])
  const documents = docsRes.data ?? []
  const checklists = checklistsRes.data ?? []
  const personnel = personnelRes.data ?? []
  const templates = templatesRes.data ?? []
  const assignments = assignmentsRes.data ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Compliance & Legal (Canada)</h1>
        <p className="text-zinc-500 dark:text-gray-400">Document templates, personnel assignments, DocuSign, and legacy compliance records.</p>
      </div>
      <ComplianceContent
        documents={documents}
        checklists={checklists}
        personnel={personnel}
        templates={templates}
        assignments={assignments as unknown as Parameters<typeof ComplianceContent>[0]['assignments']}
      />
    </div>
  )
}

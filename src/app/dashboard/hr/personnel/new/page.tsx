import { createClient } from '@/lib/supabase/server'
import { PersonnelForm } from '../personnel-form'

export default async function NewPersonnelPage() {
  const supabase = await createClient()
  const { data: regions } = await supabase.from('hr_regions').select('id, name').order('name')
  const { data: dealers } = await supabase.from('dealers').select('id, name').order('name')

  const { data: activeManagers } = await supabase
    .from('personnel')
    .select('id, full_name')
    .eq('status', 'active')
    .order('full_name')

  const { data: auroraProfileIds } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'aurora_manager')
  const profileIds = new Set((auroraProfileIds || []).map((p) => p.id))

  const { data: auroraPersonnel } = await supabase
    .from('personnel')
    .select('id, full_name, profile_id')
    .not('profile_id', 'is', null)
  const auroraManagers = (auroraPersonnel || []).filter((p) => p.profile_id && profileIds.has(p.profile_id))

  const managersMap = new Map<string, { id: string; full_name: string | null }>()
  for (const m of activeManagers || []) managersMap.set(m.id, m)
  for (const m of auroraManagers) if (!managersMap.has(m.id)) managersMap.set(m.id, { id: m.id, full_name: m.full_name })
  const managers = Array.from(managersMap.values()).sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Add Personnel</h1>
        <p className="text-gray-400">Create a new personnel record. All worker types: Employee, Contractor, Installer, Dealer Staff, etc.</p>
      </div>
      <PersonnelForm
        regions={regions || []}
        dealers={dealers || []}
        managers={managers}
      />
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PersonnelDetail } from './personnel-detail'

export const dynamic = 'force-dynamic'

async function getManagers(supabase: Awaited<ReturnType<typeof createClient>>) {
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
  return Array.from(managersMap.values()).sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
}

export default async function PersonnelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [personRes, regionsRes, dealersRes, managers, certificationsRes, timelineRes, installerRes] = await Promise.all([
    supabase
      .from('personnel')
      .select(`*, dealers(name), hr_departments(name), hr_regions(name)`)
      .eq('id', id)
      .single(),
    supabase.from('hr_regions').select('id, name').order('name'),
    supabase.from('dealers').select('id, name').order('name'),
    getManagers(supabase),
    supabase.from('personnel_certifications').select('*').eq('personnel_id', id).order('expiry_date', { ascending: true }),
    supabase.from('personnel_timeline').select('*').eq('personnel_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('installer_profiles_with_completion').select('*').eq('personnel_id', id).maybeSingle(),
  ])

  const { data: person } = personRes
  const { data: certifications } = certificationsRes
  const { data: timeline } = timelineRes

  let managerName: string | null = null
  if (person?.assigned_manager_id) {
    const { data: mgr } = await supabase.from('personnel').select('full_name').eq('id', person.assigned_manager_id).single()
    managerName = mgr?.full_name ?? null
  }

  if (!person) notFound()

  const personWithManager = { ...person, _managerName: managerName, _installerProfile: installerRes.data }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <Link href="/dashboard/hr/personnel" className="text-[#C27E00] hover:text-[#a06900] text-sm mb-4">
          ← Back to Personnel
        </Link>
      </div>
      <PersonnelDetail
        person={personWithManager}
        certifications={certifications || []}
        timeline={timeline || []}
        regions={regionsRes.data || []}
        dealers={dealersRes.data || []}
        managers={managers}
        installerProfile={installerRes.data}
      />
    </div>
  )
}

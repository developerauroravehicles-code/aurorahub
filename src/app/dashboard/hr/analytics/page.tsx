import { createClient } from '@/lib/supabase/server'
import { AnalyticsContent } from './analytics-content'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    personnelRes,
    personnelByStatusRes,
    installerRes,
    certsExpiringRes,
    certsExpiredRes,
    complianceExpiringRes,
    complianceExpiredRes,
    pendingChecklistsRes,
    activeEquipmentRes,
    reviewStatsRes,
    demandsRes,
    provinceDataRes,
    workerTypeDataRes,
  ] = await Promise.all([
    supabase.from('personnel').select('id, status, worker_type, province, start_date'),
    supabase.from('personnel').select('status').not('status', 'is', null),
    supabase.from('installer_profiles').select('installer_status, quality_score, completion_rate'),
    supabase.from('personnel_certifications').select('id, personnel_id, expiry_date, certification_type, personnel(full_name)').lte('expiry_date', in30Days).not('expiry_date', 'is', null),
    supabase.from('personnel_certifications').select('id').lt('expiry_date', today).not('expiry_date', 'is', null),
    supabase.from('compliance_documents').select('id, personnel_id, document_type, expiry_date, personnel(full_name)').lte('expiry_date', in30Days).not('expiry_date', 'is', null),
    supabase.from('compliance_documents').select('id').lt('expiry_date', today).not('expiry_date', 'is', null),
    supabase.from('compliance_checklists').select('id').eq('completed', false),
    supabase.from('equipment_assignments').select('id').is('returned_at', null),
    supabase.from('performance_reviews').select('id, status'),
    supabase.from('demands').select('id, status, completed_at').eq('status', 'completed').gte('completed_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    supabase.from('personnel').select('province').not('province', 'is', null),
    supabase.from('personnel').select('worker_type').not('worker_type', 'is', null),
  ])

  const personnel = personnelRes.data ?? []
  const certsExpiring = certsExpiringRes.data ?? []
  const certsExpired = certsExpiredRes.data ?? []
  const complianceExpiring = complianceExpiringRes.data ?? []
  const complianceExpired = complianceExpiredRes.data ?? []

  // Aggregate by status
  const statusCounts = (personnelByStatusRes.data ?? []).reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Aggregate by province
  const provinceCounts = (provinceDataRes.data ?? []).reduce((acc, p) => {
    acc[p.province ?? ''] = (acc[p.province ?? ''] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Aggregate by worker_type
  const workerTypeCounts = (workerTypeDataRes.data ?? []).reduce((acc, p) => {
    acc[p.worker_type ?? ''] = (acc[p.worker_type ?? ''] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // New hires by month (last 12 months)
  const monthsAgo = new Date()
  monthsAgo.setMonth(monthsAgo.getMonth() - 12)
  const startCutoff = monthsAgo.toISOString().split('T')[0]
  const hiresByMonth = (personnel as { start_date: string | null }[])
    .filter((p) => p.start_date && p.start_date >= startCutoff)
    .reduce((acc, p) => {
      const month = p.start_date!.slice(0, 7)
      acc[month] = (acc[month] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  // Demand completions by month (last 6 months)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const demandStart = sixMonthsAgo.toISOString().split('T')[0]
  const completedDemands = (demandsRes.data ?? []) as { completed_at: string | null }[]
  const completionsByMonth = completedDemands
    .filter((d) => d.completed_at && d.completed_at >= demandStart)
    .reduce((acc, d) => {
      const month = d.completed_at!.slice(0, 7)
      acc[month] = (acc[month] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  const installers = installerRes.data ?? []
  const avgQuality = installers.length
    ? installers.reduce((s, i) => s + (Number(i.quality_score) || 0), 0) / installers.length
    : 0
  const avgCompletion = installers.length
    ? installers.reduce((s, i) => s + (Number(i.completion_rate) || 0), 0) / installers.length
    : 0
  const activeInstallers = installers.filter((i) => i.installer_status === 'active').length
  const suspendedInstallers = installers.filter((i) => i.installer_status === 'suspended').length

  const reviews = reviewStatsRes.data ?? []
  const reviewByStatus = reviews.reduce((acc, r) => {
    const s = (r as { status: string | null }).status ?? 'draft'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const chartData = {
    statusPie: Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace('_', ' '), value })),
    provinceBar: Object.entries(provinceCounts)
      .filter(([, v]) => v > 0)
      .map(([province, count]) => ({ province, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    workerTypePie: Object.entries(workerTypeCounts).map(([name, value]) => ({ name: name.replace('_', ' '), value })),
    hiresByMonth: Object.entries(hiresByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month: month.slice(0, 7), count })),
    completionsByMonth: Object.entries(completionsByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month: month.slice(0, 7), count })),
  }

  // Normalize personnel relation (Supabase may return array for FK)
  const normPersonnel = (p: unknown) => {
    if (!p) return null
    const arr = Array.isArray(p) ? p : [p]
    const first = arr[0] as { full_name?: string } | undefined
    return first ? { full_name: first.full_name ?? '' } : null
  }
  const certsExpiringList = certsExpiring.slice(0, 10).map((c) => ({
    id: c.id,
    personnel_id: c.personnel_id,
    expiry_date: c.expiry_date,
    certification_type: c.certification_type ?? null,
    personnel: normPersonnel(c.personnel),
  }))
  const complianceExpiringList = complianceExpiring.slice(0, 10).map((c) => ({
    id: c.id,
    personnel_id: c.personnel_id,
    expiry_date: c.expiry_date,
    document_type: c.document_type ?? null,
    personnel: normPersonnel(c.personnel),
  }))

  const summary = {
    totalPersonnel: personnel.length,
    activePersonnel: statusCounts.active ?? 0,
    onboardingCount: statusCounts.onboarding ?? 0,
    suspendedCount: statusCounts.suspended ?? 0,
    activeInstallers,
    suspendedInstallers,
    avgQuality: Math.round(avgQuality * 10) / 10,
    avgCompletion: Math.round(avgCompletion * 10) / 10,
    certsExpiring: certsExpiring.length,
    certsExpired: certsExpired.length,
    complianceExpiring: complianceExpiring.length,
    complianceExpired: complianceExpired.length,
    pendingChecklists: (pendingChecklistsRes.data ?? []).length,
    activeEquipment: (activeEquipmentRes.data ?? []).length,
    totalReviews: reviews.length,
    completedReviews: reviewByStatus.completed ?? 0,
    totalCompletedDemands: completedDemands.length,
    certsExpiringList,
    complianceExpiringList,
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">HR Analytics & Insights</h1>
        <p className="text-gray-400">Workforce metrics, compliance status, installer performance, and trends.</p>
      </div>
      <AnalyticsContent summary={summary} chartData={chartData} />
    </div>
  )
}

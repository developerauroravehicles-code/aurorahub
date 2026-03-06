import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MonitoringContent } from './monitoring-content'

export const dynamic = 'force-dynamic'

export default async function MonitoringPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const [profilesRes, demandsRes, demandsByStatus, smsLogsRes, mailLogsRes, dealersRes] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('demands').select('id', { count: 'exact', head: true }),
    admin.from('demands').select('status'),
    admin.from('sms_logs').select('id', { count: 'exact', head: true }),
    admin.from('mail_logs').select('id', { count: 'exact', head: true }),
    admin.from('dealers').select('id', { count: 'exact', head: true }),
  ])

  const demands = demandsByStatus.data ?? []
  const statusCounts = demands.reduce(
    (acc, d) => {
      acc[d.status] = (acc[d.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white mt-4">Monitoring</h2>
        <p className="text-gray-400 text-sm">
          Monitor system health and key metrics.
        </p>
      </div>
      <MonitoringContent
        profilesCount={profilesRes.count ?? 0}
        demandsCount={demandsRes.count ?? 0}
        demandsByStatus={statusCounts}
        smsLogsCount={smsLogsRes.count ?? 0}
        mailLogsCount={mailLogsRes.count ?? 0}
        dealersCount={dealersRes.count ?? 0}
        dbOk={!profilesRes.error}
      />
    </div>
  )
}

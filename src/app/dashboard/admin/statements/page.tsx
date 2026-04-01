import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSystemLogo } from '@/app/dashboard/system-management/logo/actions'
import { StatementContent } from './statement-content'

export default async function StatementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, dealer_id').eq('id', user.id).single()

  const isGM = profile?.role === 'general_manager'
  const isAuroraManager = profile?.role === 'aurora_manager'
  if (!profile || (!isAuroraManager && !isGM)) {
    redirect('/dashboard')
  }

  let dealersQuery = supabase.from('dealers').select('id, name').order('name')
  if (isGM && profile.dealer_id) {
    dealersQuery = dealersQuery.eq('id', profile.dealer_id)
  }
  const { data: dealers } = await dealersQuery

  const logoUrl = await getSystemLogo()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Statement</h1>
        <p className="text-zinc-500 dark:text-gray-400">
          {isGM ? 'Generate statement for your dealer. Filter by date range.' : 'Filter by dealer and date range to generate statements. Download as PDF or save to Google Drive (Statements / Dealer / Year folder).'}
        </p>
      </div>
      <StatementContent
        dealers={dealers ?? []}
        logoDataUrl={logoUrl}
        hideDealerFilter={isGM}
        defaultDealerId={isGM && profile.dealer_id ? profile.dealer_id : undefined}
      />
    </div>
  )
}

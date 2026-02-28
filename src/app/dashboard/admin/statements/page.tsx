import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSystemLogo } from '@/app/dashboard/system-management/logo/actions'
import { StatementContent } from './statement-content'

export default async function StatementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (!profile || profile.role !== 'aurora_manager') {
    redirect('/dashboard')
  }

  const { data: dealers } = await supabase
    .from('dealers')
    .select('id, name')
    .order('name')

  const logoUrl = await getSystemLogo()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Statement</h1>
        <p className="text-gray-400">
          Filter by dealer and date range to generate statements. Download as PDF or save to Google Drive
          (Statements / Dealer / Year folder).
        </p>
      </div>
      <StatementContent dealers={dealers ?? []} logoDataUrl={logoUrl} />
    </div>
  )
}

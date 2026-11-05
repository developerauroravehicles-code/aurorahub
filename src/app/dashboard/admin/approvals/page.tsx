import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { listPendingExpenseClaims } from './actions'
import { ApprovalsContent } from './approvals-content'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') redirect('/dashboard')

  const result = await listPendingExpenseClaims()
  if (result.error) {
    return (
      <div className="text-red-500">
        {result.error}
      </div>
    )
  }

  return <ApprovalsContent initialClaims={result.claims ?? []} />
}

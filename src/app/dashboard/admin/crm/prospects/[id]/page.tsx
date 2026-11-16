import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchProspectCrmDetail } from '@/lib/crm/load-prospect'
import { DealerCrmNotes } from '../../dealer-crm-notes'
import { ProspectDetailClient } from '../../prospect-detail-client'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function CrmProspectDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') redirect('/dashboard')

  const detail = await fetchProspectCrmDetail(supabase, id)
  if (!detail) notFound()

  const p = detail.prospect

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/admin/crm/prospects" className="text-sm text-[#C27E00] hover:underline">
          ← Prospects
        </Link>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{p.name}</h2>
        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">Potential dealer — not yet in Configuration</p>
      </div>

      <ProspectDetailClient prospectId={id} prospect={p} />

      <DealerCrmNotes
        owner={{ type: 'prospect', prospectId: id }}
        mainSummary={p.summary ?? null}
        notes={detail.notes}
        emailSuggestions={detail.emailSuggestions}
      />
    </div>
  )
}
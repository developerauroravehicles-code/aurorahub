import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCrmSnapshot, listAcquirerCandidates } from '../../actions'
import { fetchDealerCrmDetail, salesStatForDealer } from '@/lib/crm/load-crm-data'
import { DealerDetailClient } from '../../dealer-detail-client'
import { DealerCrmNotes } from '../../dealer-crm-notes'
import { regionCodeLabel } from '@/lib/crm/region-label'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ year?: string; quarter?: string }>
}

export default async function CrmDealerDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') redirect('/dashboard')

  const detail = await fetchDealerCrmDetail(supabase, id)
  if (!detail) notFound()

  const snapshotResult = await getCrmSnapshot(sp.year, sp.quarter)
  const stat =
    snapshotResult.snapshot
      ? salesStatForDealer(id, snapshotResult.snapshot.sales.byDealer)
      : { completedCount: 0, salesTotal: 0, sharePercent: 0 }

  const candidates = await listAcquirerCandidates()
  const d = detail.dealer

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/admin/crm/dealers" className="text-sm text-[#C27E00] hover:underline">
          ← All dealers
        </Link>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{d.name}</h2>
        <p className="text-sm text-zinc-500">
          {d.code} · {regionCodeLabel(d.region_codes as Parameters<typeof regionCodeLabel>[0]) ?? 'No region'}
        </p>
        {d.address ? <p className="text-sm text-zinc-600 dark:text-gray-400 mt-1">{d.address}</p> : null}
        {d.phone ? <p className="text-sm text-zinc-600 dark:text-gray-400">Phone: {d.phone}</p> : null}
      </div>

      <DealerDetailClient
        dealerId={id}
        dealer={{
          primary_contact_name: d.primary_contact_name,
          primary_contact_email: d.primary_contact_email,
          acquired_by_profile_id: d.acquired_by_profile_id,
          acquired_at: d.acquired_at,
          acquired_by_name: d.acquired_by_name,
        }}
        stats={stat}
        acquirerCandidates={candidates.profiles ?? []}
      />

      <DealerCrmNotes
        owner={{ type: 'dealer', dealerId: id }}
        mainSummary={d.crm_summary ?? null}
        notes={detail.notes}
        emailSuggestions={detail.emailSuggestions}
      />
    </div>
  )
}
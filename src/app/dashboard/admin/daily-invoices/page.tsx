import { createClient } from '@/lib/supabase/server'

import { createAdminClient } from '@/lib/supabase/admin'

import { redirect } from 'next/navigation'

import { ptTodayDate, syncDailyBatchesForPtDate } from '@/lib/daily-dealer-invoices'

import { DailyInvoicesContent, type DailyInvoiceDealerRow } from './daily-invoices-content'



type PageProps = {

  searchParams: Promise<{ date?: string }>

}



type DemandSnapshot = DailyInvoiceDealerRow['items'][number]['demand']



type BatchItemRow = {

  demandId: string

  included: boolean

  sortOrder: number

  demand: DemandSnapshot

}



function dealerRowScore(row: DailyInvoiceDealerRow): number {

  let score = 0

  if (row.items.length > 0) score += 1000

  if (row.recipientEmails.length > 0) score += 100

  if (row.dealerCode.trim()) score += 10

  return score

}



/** Collapse duplicate dealer names when only one copy has activity. */
function dedupeDealerRows(rows: DailyInvoiceDealerRow[]): DailyInvoiceDealerRow[] {
  const byName = new Map<string, DailyInvoiceDealerRow[]>()
  for (const row of rows) {
    const key = row.dealerName.trim().toLowerCase()
    const list = byName.get(key) ?? []
    list.push(row)
    byName.set(key, list)
  }

  const result: DailyInvoiceDealerRow[] = []
  for (const group of byName.values()) {
    if (group.length === 1) {
      result.push(group[0])
      continue
    }

    const withItems = group.filter((r) => r.items.length > 0)
    if (withItems.length >= 1) {
      result.push(...withItems)
      continue
    }

    result.push(
      group.reduce((best, row) => (dealerRowScore(row) > dealerRowScore(best) ? row : best))
    )
  }
  return result
}



function sortDealerRows(rows: DailyInvoiceDealerRow[]): DailyInvoiceDealerRow[] {

  return [...rows].sort((a, b) => {

    const aHas = a.items.length > 0 ? 0 : 1

    const bHas = b.items.length > 0 ? 0 : 1

    if (aHas !== bHas) return aHas - bHas

    return a.dealerName.localeCompare(b.dealerName)

  })

}



function normalizeDealerRow(row: DailyInvoiceDealerRow): DailyInvoiceDealerRow {

  if (row.items.length > 0) return row

  return {

    ...row,

    id: null,

    status: 'empty',

    reviewNotifiedAt: null,

    sentAt: null,

  }

}



export default async function DailyInvoicesPage({ searchParams }: PageProps) {

  const supabase = await createClient()

  const {

    data: { user },

  } = await supabase.auth.getUser()

  if (!user) redirect('/login')



  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (!profile || profile.role !== 'aurora_manager') {

    redirect('/dashboard')

  }



  const sp = await searchParams

  const batchDate =

    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : ptTodayDate()



  const admin = createAdminClient()

  await syncDailyBatchesForPtDate(admin, batchDate)



  const [batchesRes, emailsRes, dealersRes] = await Promise.all([

    admin

      .from('dealer_daily_invoice_batches')

      .select(

        `

        id,

        dealer_id,

        batch_date,

        status,

        review_notified_at,

        sent_at,

        dealers(id, name, code)

      `

      )

      .eq('batch_date', batchDate),

    admin.from('dealer_invoice_emails').select('id, dealer_id, email, label'),

    admin.from('dealers').select('id, name, code').order('name'),

  ])



  const batches = batchesRes.data ?? []

  const allDealers = dealersRes.data ?? []

  const batchIds = batches.map((b) => b.id)



  let items: Array<{

    batch_id: string

    demand_id: string

    included: boolean

    sort_order: number

    demands: unknown

  }> = []



  if (batchIds.length > 0) {

    const { data: itemsData } = await admin

      .from('dealer_daily_invoice_batch_items')

      .select(

        `

        batch_id,

        demand_id,

        included,

        sort_order,

        demands(

          id,

          demand_number,

          customer_firstname,

          customer_lastname,

          camera_model,

          service_type,

          invoice_total_amount,

          invoice_comments,

          invoice_approved_at,

          completed_at,

          stock_number

        )

      `

      )

      .in('batch_id', batchIds)

      .order('sort_order')



    items = (itemsData ?? []) as typeof items

  }



  const emailsByDealer: Record<string, { id: string; email: string; label: string | null }[]> = {}

  for (const row of emailsRes.data ?? []) {

    const did = row.dealer_id as string

    if (!emailsByDealer[did]) emailsByDealer[did] = []

    emailsByDealer[did].push({

      id: row.id as string,

      email: row.email as string,

      label: (row.label as string | null) ?? null,

    })

  }



  const batchByDealerId = new Map<string, DailyInvoiceDealerRow>(

    batches.map((batch) => {

      const batchItems: BatchItemRow[] = items

        .filter((i) => i.batch_id === batch.id)

        .map((i) => {

          const dRaw = i.demands

          const d = Array.isArray(dRaw) ? dRaw[0] : dRaw

          if (!d || typeof d !== 'object') return null

          const demand = d as DemandSnapshot

          return {

            demandId: i.demand_id as string,

            included: i.included as boolean,

            sortOrder: i.sort_order as number,

            demand,

          }

        })

        .filter((i): i is BatchItemRow => i != null)

        .sort((a, b) => a.sortOrder - b.sortOrder)



      const dealerRaw = batch.dealers

      const dealer = Array.isArray(dealerRaw) ? dealerRaw[0] : dealerRaw



      return [

        batch.dealer_id as string,

        normalizeDealerRow({

          id: batch.id as string,

          dealerId: batch.dealer_id as string,

          batchDate: batch.batch_date as string,

          status: batch.status as string,

          reviewNotifiedAt: (batch.review_notified_at as string | null) ?? null,

          sentAt: (batch.sent_at as string | null) ?? null,

          dealerName: (dealer as { name?: string } | null)?.name ?? 'Unknown dealer',

          dealerCode: (dealer as { code?: string } | null)?.code ?? '',

          items: batchItems,

          recipientEmails: emailsByDealer[batch.dealer_id as string] ?? [],

        }),

      ]

    })

  )



  const dealerRows = sortDealerRows(

    dedupeDealerRows(

      allDealers.map((dealer) => {

        const existing = batchByDealerId.get(dealer.id as string)

        if (existing) return existing

        return normalizeDealerRow({

          id: null,

          dealerId: dealer.id as string,

          batchDate,

          status: 'empty',

          reviewNotifiedAt: null,

          sentAt: null,

          dealerName: dealer.name as string,

          dealerCode: (dealer.code as string) ?? '',

          items: [],

          recipientEmails: emailsByDealer[dealer.id as string] ?? [],

        })

      })

    )

  )



  const withInvoiceCount = dealerRows.filter((b) => b.items.length > 0).length



  return (

    <div className="space-y-8 pb-12">

      <div>

        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Daily Invoices</h1>

        <p className="text-zinc-500 dark:text-gray-400">

          Dealer-based invoice lists for each Pacific Time day. Lists update when jobs are completed. Review and send

          invoice PDFs to dealer email addresses after the 9:00 PM PT notification.

        </p>

      </div>

      <DailyInvoicesContent

        batchDate={batchDate}

        batches={dealerRows}

        totalDealers={dealerRows.length}

        withInvoiceCount={withInvoiceCount}

      />

    </div>

  )

}



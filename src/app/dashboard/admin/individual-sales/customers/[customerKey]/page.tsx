import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { formatInPT } from '@/lib/timezone-defaults'
import { warrantyEndFromCompletion } from '@/lib/warranty-period'
import { customerRouteKeyToPhoneKey } from '@/lib/customer-key'
import { INDIVIDUAL_SALES_CUSTOMERS, INDIVIDUAL_SALES_DEMANDS } from '@/lib/individual-sales'

type DemandRow = {
  id: string
  demand_number: string | null
  status: string
  camera_model: string
  completed_at: string | null
  updated_at: string | null
  customer_firstname: string
  customer_lastname: string
  customer_phone: string
  dealers: { name: string; warranty_years: number | null } | null
}

function digitsOnly(phone: string): string {
  return (phone ?? '').replace(/\D/g, '')
}

function warrantyEndLabel(
  status: string,
  completedAt: string | null,
  updatedAt: string | null,
  dealerName: string | null,
  dealerWarrantyYears: number | null
): string {
  if (status !== 'completed') return '—'
  const basis = completedAt ?? updatedAt
  if (!basis) return '—'
  const warrantyEnd = warrantyEndFromCompletion(new Date(basis), {
    name: dealerName,
    warranty_years: dealerWarrantyYears,
  })
  return formatInPT(warrantyEnd, 'd MMMM yyyy')
}

export default async function IndividualCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerKey: string }>
}) {
  const { customerKey } = await params
  const phoneKey = customerRouteKeyToPhoneKey(customerKey)
  if (!phoneKey) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') redirect('/dashboard')

  const { data: rawRows } = await supabase
    .from('demands')
    .select(
      `id, demand_number, status, camera_model, completed_at, updated_at,
      customer_firstname, customer_lastname, customer_phone,
      dealers(name, warranty_years)`
    )
    .eq('is_individual', true)
    .order('updated_at', { ascending: false })

  const demands = (rawRows ?? []).filter((d) => digitsOnly(d.customer_phone ?? '') === phoneKey)
  if (demands.length === 0) notFound()

  const latest = demands[0]
  const displayName =
    `${latest.customer_firstname ?? ''} ${latest.customer_lastname ?? ''}`.trim() || 'Unknown'

  return (
    <div className="space-y-8">
      <Link
        href={INDIVIDUAL_SALES_CUSTOMERS}
        className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-[#C27E00] dark:text-gray-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to customers
      </Link>

      <div className="rounded-lg border border-zinc-200 bg-zinc-200/50 p-6 dark:border-gray-800 dark:bg-white/5">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">{displayName}</h2>
        <p className="mt-1 text-zinc-600 dark:text-gray-400">{latest.customer_phone}</p>
        <p className="mt-2 text-sm text-zinc-500">
          {demands.length} individual appointment{demands.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-gray-800">
        <table className="min-w-full text-left text-sm">
          <thead className="text-zinc-600 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Demand</th>
              <th className="px-4 py-3 font-medium">Camera</th>
              <th className="px-4 py-3 font-medium">Warranty ends</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-gray-800 text-zinc-900 dark:text-white">
            {demands.map((d) => {
              const dealerRaw = d.dealers as { name: string; warranty_years: number | null } | { name: string; warranty_years: number | null }[] | null
              const dealer = Array.isArray(dealerRaw) ? dealerRaw[0] : dealerRaw
              return (
                <tr key={d.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/admin/demands/${d.id}?return=${encodeURIComponent(INDIVIDUAL_SALES_DEMANDS)}`}
                      className="font-medium text-[#C27E00] hover:underline"
                    >
                      {d.demand_number ?? d.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{d.camera_model}</td>
                  <td className="px-4 py-3">
                    {warrantyEndLabel(
                      d.status,
                      d.completed_at,
                      d.updated_at,
                      dealer?.name ?? null,
                      dealer?.warranty_years ?? null
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{d.status.replace('_', ' ')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
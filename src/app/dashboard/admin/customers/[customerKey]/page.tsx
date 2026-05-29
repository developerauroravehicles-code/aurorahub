import { canAccessAdminCustomers, getInventoryManagerDealerId, isInventoryManager, normalizeUserRole } from '@/lib/inventory-manager-access'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { addYears } from 'date-fns'
import { formatInPT } from '@/lib/timezone-defaults'
import { customerRouteKeyToPhoneKey } from '@/lib/customer-key'
import { CustomerDemandsExcelButton } from '../customers-excel-export'

type DemandRow = {
  id: string
  demand_number: string | null
  status: string
  camera_model: string
  completed_at: string | null
  updated_at: string | null
  dealer_id: string | null
  dealer_name: string | null
  customer_firstname: string
  customer_lastname: string
  customer_phone: string
}

function pickLatestDemand(demands: DemandRow[]): DemandRow {
  return demands.reduce((best, d) => {
    const bestTs = best.updated_at ? new Date(best.updated_at).getTime() : 0
    const dTs = d.updated_at ? new Date(d.updated_at).getTime() : 0
    return dTs >= bestTs ? d : best
  })
}

function warrantyEndLabel(status: string, completedAt: string | null, updatedAt: string | null): string {
  if (status !== 'completed') return '—'
  const basis = completedAt ?? updatedAt
  if (!basis) return '—'
  const warrantyEnd = addYears(new Date(basis), 3)
  return formatInPT(warrantyEnd, 'd MMMM yyyy')
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ customerKey: string }> }) {
  const { customerKey } = await params
  const phoneKey = customerRouteKeyToPhoneKey(customerKey)
  if (!phoneKey) {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('role, dealer_id').eq('id', user.id).single()
  if (!profile) return <div className="text-zinc-900 dark:text-white">Access denied</div>

  if (profile.role === 'it') {
    redirect('/dashboard/identity')
  }
  if (normalizeUserRole(profile.role) === 'general_manager') {
    redirect('/dashboard')
  }
  if (!canAccessAdminCustomers(profile.role)) {
    redirect('/dashboard')
  }
  if (isInventoryManager(profile.role) && !getInventoryManagerDealerId(profile)) {
    redirect('/dashboard')
  }

  const imDealerId = getInventoryManagerDealerId(profile)

  const { data: demandRows, error } = await supabase.rpc('customer_directory_demands', {
    p_phone_key: phoneKey,
  })

  if (error) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/admin/customers"
          className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-[#C27E00] dark:text-gray-400 dark:hover:text-[#C27E00]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to customers
        </Link>
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Could not load customer: {error.message}
        </p>
      </div>
    )
  }

  const demands = ((demandRows ?? []) as DemandRow[]).filter(
    (d) => !imDealerId || d.dealer_id === imDealerId
  )
  if (demands.length === 0) {
    notFound()
  }

  const latest = pickLatestDemand(demands)
  const displayName =
    `${latest.customer_firstname ?? ''} ${latest.customer_lastname ?? ''}`.trim() || 'Unknown'

  const demandsExcelRows = demands.map((d) => ({
    demandNumber: d.demand_number ?? d.id.slice(0, 8),
    camera: d.camera_model ?? '',
    dealer: d.dealer_name ?? '—',
    warrantyEnds: warrantyEndLabel(d.status, d.completed_at, d.updated_at),
    status: d.status.replace(/_/g, ' '),
  }))

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/admin/customers"
        className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-[#C27E00] dark:text-gray-400 dark:hover:text-[#C27E00]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to customers
      </Link>

      <div className="rounded-lg border border-zinc-200 bg-zinc-200/50 p-6 dark:border-gray-800 dark:bg-white/5">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">{displayName}</h1>
        <p className="mt-1 text-zinc-600 dark:text-gray-400">{latest.customer_phone}</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-gray-500">
          {demands.length} demand{demands.length === 1 ? '' : 's'} on file
        </p>
      </div>

      <div>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-white">Demands and installations</h2>
          <CustomerDemandsExcelButton
            filenamePrefix={`cust-${phoneKey}`}
            customerTitle={displayName}
            customerPhone={latest.customer_phone}
            rows={demandsExcelRows}
          />
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-200/50 dark:border-gray-800 dark:bg-white/5">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-gray-800">
            <thead>
              <tr className="text-zinc-600 dark:text-gray-400">
                <th className="px-4 py-3 font-medium">Demand</th>
                <th className="px-4 py-3 font-medium">Camera</th>
                <th className="px-4 py-3 font-medium">Dealer</th>
                <th className="px-4 py-3 font-medium">Warranty ends</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
              {demands.map((d) => (
                <tr key={d.id} className="text-zinc-900 dark:text-white">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/dashboard/admin/demands/${d.id}`}
                      className="font-medium text-[#C27E00] hover:underline"
                    >
                      {d.demand_number ?? d.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{d.camera_model}</td>
                  <td className="px-4 py-3">{d.dealer_name ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">{warrantyEndLabel(d.status, d.completed_at, d.updated_at)}</td>
                  <td className="px-4 py-3 capitalize">{d.status.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-gray-500">
          Warranty end is three years after completion date (same rule as invoices).
        </p>
      </div>
    </div>
  )
}

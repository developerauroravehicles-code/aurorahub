import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatInPT } from '@/lib/timezone-defaults'
import { phoneKeyToCustomerRouteKey } from '@/lib/customer-key'
import { CustomersListExcelButton } from './customers-excel-export'

type CustomerSummaryRow = {
  phone_key: string
  customer_phone: string
  customer_firstname: string
  customer_lastname: string
  demand_count: number
  last_activity: string
  latest_camera_model: string | null
  latest_dealer_name: string | null
  latest_warranty_end: string | null
}

export default async function CustomersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return <div className="text-zinc-900 dark:text-white">Access denied</div>

  if (profile.role === 'it') {
    redirect('/dashboard/identity')
  }
  if (profile.role === 'general_manager') {
    redirect('/dashboard')
  }
  if (profile.role !== 'aurora_manager') {
    redirect('/dashboard')
  }

  const { data: rows, error } = await supabase.rpc('customer_directory_summaries')

  const summaries = (rows ?? []) as CustomerSummaryRow[]

  const excelRows = summaries.map((row) => ({
    firstName: row.customer_firstname ?? '',
    lastName: row.customer_lastname ?? '',
    phone: row.customer_phone ?? '',
    demandCount: row.demand_count,
    lastActivity: formatInPT(row.last_activity, 'yyyy-MM-dd'),
    latestCamera: row.latest_camera_model ?? '',
    latestDealer: row.latest_dealer_name ?? '',
    latestWarrantyEnd: row.latest_warranty_end ?? null,
  }))

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Customers</h1>
          <CustomersListExcelButton rows={excelRows} />
        </div>
        <p className="mb-4 text-sm text-zinc-600 dark:text-gray-400">
          Customers are grouped by phone number across all demands.
        </p>
        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            Could not load customers: {error.message}
          </p>
        )}
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200/50 shadow dark:border-gray-800 dark:bg-white/5">
          {summaries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-gray-400">No customers found.</p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-gray-800">
              {summaries.map((row) => {
                const name = `${row.customer_firstname ?? ''} ${row.customer_lastname ?? ''}`.trim() || 'Unknown'
                const routeKey = phoneKeyToCustomerRouteKey(row.phone_key)
                return (
                  <li key={row.phone_key}>
                    <Link
                      href={`/dashboard/admin/customers/${routeKey}`}
                      className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-zinc-200/50 dark:hover:bg-white/5"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-900 dark:text-white">{name}</p>
                        <p className="truncate text-sm text-zinc-500 dark:text-gray-400">{row.customer_phone}</p>
                      </div>
                      <div className="shrink-0 text-right text-sm text-zinc-600 dark:text-gray-400">
                        <p>
                          <span className="text-[#C27E00]">{row.demand_count}</span> demand
                          {row.demand_count === 1 ? '' : 's'}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-gray-500">
                          Last activity {formatInPT(row.last_activity, 'd MMM yyyy')}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

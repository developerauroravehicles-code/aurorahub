import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatInPT } from '@/lib/timezone-defaults'
import { canAccessAdminCustomers, normalizeUserRole } from '@/lib/inventory-manager-access'
import { getSmsSettings } from '@/lib/sms-resolver'
import { CustomersListExcelButton } from './customers-excel-export'
import { CustomersDirectoryList } from './customers-directory-list'

/** Bulk SMS runs in-process; extend limit so large selections can finish (requires host support, e.g. Vercel). */
export const maxDuration = 120

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
  if (normalizeUserRole(profile.role) === 'general_manager') {
    redirect('/dashboard')
  }
  if (!canAccessAdminCustomers(profile.role)) {
    redirect('/dashboard')
  }

  const [{ data: rows, error }, smsSettings] = await Promise.all([
    supabase.rpc('customer_directory_summaries'),
    getSmsSettings(supabase),
  ])

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

  const signaturePreview =
    typeof smsSettings.signature === 'string' ? smsSettings.signature.trim() : ''

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
        {summaries.length === 0 && !error ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-gray-400">No customers found.</p>
        ) : summaries.length > 0 ? (
          <CustomersDirectoryList rows={summaries} signaturePreview={signaturePreview} />
        ) : null}
      </div>
    </div>
  )
}

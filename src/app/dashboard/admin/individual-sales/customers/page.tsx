import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { canUseSmsFeatures } from '@/lib/inventory-manager-access'
import { getSmsSettings } from '@/lib/sms-resolver'
import { CustomersDirectoryList } from '@/app/dashboard/admin/customers/customers-directory-list'

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
  last_sms_at: string | null
  last_sms_body: string | null
  last_sms_status: string | null
  last_sms_error: string | null
}

function digitsOnlyPhone(phone: string): string {
  return (phone ?? '').replace(/\D/g, '')
}

export default async function IndividualSalesCustomersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'aurora_manager') redirect('/dashboard')

  const { data: individualPhones } = await supabase
    .from('demands')
    .select('customer_phone')
    .eq('is_individual', true)

  const phoneKeys = new Set(
    (individualPhones ?? []).map((r) => digitsOnlyPhone(r.customer_phone ?? '')).filter((k) => k.length > 0)
  )

  const canSendSms = canUseSmsFeatures(profile.role)

  const [{ data: rows, error }, smsSettings] = await Promise.all([
    supabase.rpc('customer_directory_summaries'),
    canSendSms ? getSmsSettings(supabase) : Promise.resolve({ signature: '' }),
  ])

  if (error) {
    return <div className="text-red-600 dark:text-red-400">Failed to load customers.</div>
  }

  const summaries = ((rows ?? []) as CustomerSummaryRow[]).filter((row) => phoneKeys.has(row.phone_key))
  const signaturePreview = smsSettings.signature ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-1">Customers</h2>
        <p className="text-sm text-zinc-500 dark:text-gray-400">
          Customers with at least one individual sales appointment.
        </p>
      </div>
      {summaries.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-gray-400">No customers yet.</p>
      ) : (
        <CustomersDirectoryList
          rows={summaries}
          signaturePreview={signaturePreview}
          canSendSms={canSendSms}
          customerDetailBasePath="/dashboard/admin/individual-sales/customers"
        />
      )}
    </div>
  )
}
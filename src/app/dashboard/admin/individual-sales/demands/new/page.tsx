import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCameraModelsForDealer } from '@/app/dashboard/admin/demands/get-cameras-for-dealer'
import { getIndividualSalesDealerId } from '@/lib/individual-sales'
import { INDIVIDUAL_SALES_DEMANDS } from '@/lib/individual-sales'
import { IndividualDemandForm } from './individual-demand-form'

export default async function NewIndividualDemandPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dealerId = await getIndividualSalesDealerId(supabase)
  if (!dealerId) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Individual Sales dealer is not configured. Apply Supabase migration{' '}
        <code className="text-xs">20261119180000_individual_sales.sql</code>.
      </p>
    )
  }

  const [{ data: dealer }, cameraModels, { data: specialists }] = await Promise.all([
    supabase.from('dealers').select('name, address').eq('id', dealerId).single(),
    getCameraModelsForDealer(dealerId),
    supabase.from('profiles').select('id, full_name').eq('role', 'specialist').order('full_name'),
  ])

  return (
    <div className="space-y-6">
      <Link
        href={INDIVIDUAL_SALES_DEMANDS}
        className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-[#C27E00] dark:text-gray-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to appointments
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">New appointment</h2>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mb-6 max-w-2xl">
          Enter customer and vehicle details and set the appointment time manually. Dealer is{' '}
          <strong>{dealer?.name ?? 'Individual Sales'}</strong>.
        </p>
        <IndividualDemandForm
          cameraModels={cameraModels}
          specialists={specialists ?? []}
          defaultAddress={dealer?.address ?? undefined}
        />
      </div>
    </div>
  )
}
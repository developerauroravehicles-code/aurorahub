import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSystemLogo } from '@/lib/get-system-logo'
import { InvoicePreviewEditor } from '../invoice-preview-editor'
import type { InvoicePreviewRecord } from '../invoice-types'

type PageProps = {
  params: Promise<{ demandId: string }>
  searchParams: Promise<{ return?: string }>
}

const DEMAND_SELECT = `
  id,
  demand_number,
  dealer_id,
  stock_number,
  vin_last6,
  customer_phone,
  customer_firstname,
  customer_lastname,
  customer_address,
  vehicle_year,
  vehicle_make,
  vehicle_model,
  camera_model,
  updated_at,
  completed_at,
  service_type,
  invoice_total_amount,
  invoice_comments,
  invoice_extra_rows,
  invoice_financial_summary,
  invoice_saved_at,
  invoice_downloaded_at,
  invoice_drive_uploaded_at,
  invoice_approved_at,
  invoice_approved_by,
  dealers(name, address, phone, warranty_years)
`

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { demandId } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('demands')
    .select('demand_number')
    .eq('id', demandId)
    .maybeSingle()
  const label = data?.demand_number ? `#${data.demand_number}` : 'Invoice'
  return { title: `${label} — Invoice` }
}

export default async function InvoiceDetailPage({ params, searchParams }: PageProps) {
  const [{ demandId }, sp] = await Promise.all([params, searchParams])

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAuroraManager = profile?.role === 'aurora_manager'
  const isGM = profile?.role === 'general_manager'
  if (!profile || (!isAuroraManager && !isGM)) {
    redirect('/dashboard')
  }

  const { data: demand } = await supabase
    .from('demands')
    .select(DEMAND_SELECT)
    .eq('id', demandId)
    .eq('status', 'completed')
    .maybeSingle()

  if (!demand) notFound()

  const logoUrl = await getSystemLogo()
  const returnHref =
    typeof sp.return === 'string' && sp.return.startsWith('/dashboard/admin/')
      ? sp.return
      : undefined
  const backHref = returnHref ?? '/dashboard/admin/invoices'

  return (
    <div className="space-y-6 pb-12">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-[#C27E00] dark:text-gray-400 dark:hover:text-[#C27E00] mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-1">Invoice</h1>
        <p className="text-zinc-500 dark:text-gray-400">
          Review and edit the invoice PDF before sending or downloading.
        </p>
      </div>

      <InvoicePreviewEditor
        invoice={demand as InvoicePreviewRecord}
        logoDataUrl={logoUrl}
        canEdit={isAuroraManager}
        returnHref={backHref}
      />
    </div>
  )
}

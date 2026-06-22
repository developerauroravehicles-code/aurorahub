'use client'

import { formatInTimeZone } from 'date-fns-tz'
import { ShieldCheck } from 'lucide-react'
import type { CustomerPortalRow } from '@/types/customer-portal'
import { dealerTimezone } from '@/lib/customer-portal-utils'
import { warrantyPeriodDescription } from '@/lib/warranty-period'

type Props = {
  row: CustomerPortalRow
}

export function WarrantyPanel({ row }: Props) {
  const tz = dealerTimezone(row)
  const status = (row.status || '').toLowerCase()
  const completed = status === 'completed'

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/40 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[#C27E00]" />
        Installation warranty
      </h3>

      {row.warranty_end ? (
        <p className="text-sm text-zinc-800 dark:text-gray-200">
          Your installation warranty is valid until{' '}
          <span className="font-semibold tabular-nums">
            {formatInTimeZone(new Date(`${row.warranty_end}T12:00:00Z`), tz, 'MMMM d, yyyy')}
          </span>
          .
        </p>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-gray-400">
          {completed
            ? 'Warranty details are being finalized for this installation.'
            : 'Warranty coverage begins after your installation is marked completed.'}
        </p>
      )}

      <ul className="text-xs text-zinc-500 dark:text-gray-500 space-y-1 list-disc pl-4">
        <li>Covers workmanship related to your dashcam installation.</li>
        <li>Standard coverage period is {warrantyPeriodDescription(row.dealer_name)} from completion date.</li>
        <li>Contact your dealer for warranty service or questions.</li>
      </ul>
    </section>
  )
}

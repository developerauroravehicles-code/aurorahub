'use client'

import { Building2, MapPin, Phone } from 'lucide-react'
import type { CustomerPortalRow } from '@/types/customer-portal'
import { mapsSearchUrl } from '@/lib/customer-portal-utils'

type Props = {
  row: CustomerPortalRow
}

export function DealerContactPanel({ row }: Props) {
  const phone = row.dealer_phone?.trim()
  const address = row.dealer_address?.trim()
  const name = row.dealer_name?.trim()

  if (!name && !phone && !address) return null

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/40 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
        <Building2 className="h-4 w-4 text-[#C27E00]" />
        Your dealer
      </h3>

      <dl className="space-y-2 text-sm">
        {name ? (
          <div>
            <dt className="text-xs text-zinc-500 dark:text-gray-500">Dealer</dt>
            <dd className="font-medium text-zinc-900 dark:text-white">{name}</dd>
          </div>
        ) : null}
        {address ? (
          <div>
            <dt className="text-xs text-zinc-500 dark:text-gray-500 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Address
            </dt>
            <dd className="text-zinc-800 dark:text-gray-200">{address}</dd>
          </div>
        ) : null}
        {phone ? (
          <div>
            <dt className="text-xs text-zinc-500 dark:text-gray-500 flex items-center gap-1">
              <Phone className="h-3 w-3" />
              Phone
            </dt>
            <dd>
              <a
                href={`tel:${phone.replace(/\s/g, '')}`}
                className="text-[#C27E00] hover:underline font-medium"
              >
                {phone}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      {address ? (
        <a
          href={mapsSearchUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-[#C27E00] hover:underline"
        >
          View dealer on map
        </a>
      ) : null}

      <p className="text-xs text-zinc-500 dark:text-gray-500">
        For rescheduling, billing, or invoice requests, contact your dealer directly.
      </p>
    </section>
  )
}

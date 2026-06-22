'use client'

import { formatInTimeZone } from 'date-fns-tz'
import { Calendar, MapPin, Navigation } from 'lucide-react'
import type { CustomerPortalRow } from '@/types/customer-portal'
import {
  dealerTimezone,
  mapsSearchUrl,
  resolveAppointmentAddress,
  statusLabel,
} from '@/lib/customer-portal-utils'

type Props = {
  row: CustomerPortalRow
}

export function AppointmentPanel({ row }: Props) {
  const tz = dealerTimezone(row)
  const address = resolveAppointmentAddress(row)
  const status = (row.status || '').toLowerCase()

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/40 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
        <Calendar className="h-4 w-4 text-[#C27E00]" />
        Appointment
      </h3>

      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs text-zinc-500 dark:text-gray-500">Date & time</dt>
          <dd className="tabular-nums text-zinc-800 dark:text-gray-200">
            {row.appointment_date
              ? formatInTimeZone(new Date(row.appointment_date), tz, 'EEEE, MMMM d, yyyy · h:mm a zzz')
              : '—'}
          </dd>
        </div>
        {address ? (
          <div>
            <dt className="text-xs text-zinc-500 dark:text-gray-500 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Location
            </dt>
            <dd className="text-zinc-800 dark:text-gray-200">{address}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-zinc-500 dark:text-gray-500">Status</dt>
          <dd className="text-zinc-800 dark:text-gray-200">{statusLabel(row.status)}</dd>
        </div>
      </dl>

      {address ? (
        <a
          href={mapsSearchUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-800 dark:text-gray-200 hover:border-[#C27E00] hover:text-[#C27E00] transition-colors"
        >
          <Navigation className="h-4 w-4" />
          Open in Maps
        </a>
      ) : null}

      {status === 'approved' ? (
        <p className="text-xs text-zinc-500 dark:text-gray-500">
          Please arrive about 10 minutes early and ensure your vehicle is accessible for the installer.
        </p>
      ) : null}
    </section>
  )
}

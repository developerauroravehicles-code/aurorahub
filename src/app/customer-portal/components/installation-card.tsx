'use client'

import { formatInTimeZone } from 'date-fns-tz'
import type { CustomerPortalRow } from '@/types/customer-portal'
import { dealerTimezone, serviceTypeLabel, statusLabel } from '@/lib/customer-portal-utils'
import { ProgressTracker } from './progress-tracker'
import { AppointmentPanel } from './appointment-panel'
import { DealerContactPanel } from './dealer-contact-panel'
import { WarrantyPanel } from './warranty-panel'
import { DocumentsPanel } from './documents-panel'
import { RatingPanel } from './rating-panel'
import { ServiceRecordPanel } from './service-record-panel'
import { CameraInfoPanel } from './camera-info-panel'
import { PortalContactPanel } from './portal-contact-panel'
import type { PortalContactInfo } from '@/types/customer-portal'

type Props = {
  row: CustomerPortalRow
  rowIndex: number
  vinQuery: string
  serviceRecordsRefreshToken?: number
  onRated: (index: number, customerRating: number, qualityScore: number, comment: string) => void
  portalContact?: PortalContactInfo | null
}

export function InstallationCard({
  row,
  rowIndex,
  vinQuery,
  serviceRecordsRefreshToken,
  onRated,
  portalContact,
}: Props) {
  const tz = dealerTimezone(row)
  const effectiveVinQuery = vinQuery.trim() || row.vin_last6?.trim() || ''
  const greeting = row.customer_firstname?.trim()
  const vehicle = `${row.vehicle_year} ${row.vehicle_make} ${row.vehicle_model}`.trim()
  const status = (row.status || '').toLowerCase()
  const statusTone =
    status === 'completed'
      ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300 border-green-200 dark:border-green-900'
      : status === 'approved'
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-900'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-900'

  return (
    <article className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-[#C27E00]/10 via-transparent to-transparent px-4 py-4 sm:px-6">
        {greeting ? (
          <p className="text-sm text-[#C27E00] font-medium mb-1">Hi, {greeting}</p>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{vehicle || 'Your vehicle'}</h3>
            <p className="text-sm text-zinc-500 dark:text-gray-400 mt-0.5">
              {row.demand_number ? `#${row.demand_number}` : 'Reference pending'}
              {row.stock_number?.trim() ? ` · Stock ${row.stock_number.trim()}` : ''}
            </p>
          </div>
          <span
            className={`text-xs uppercase tracking-wide px-2.5 py-1 rounded-full border font-semibold ${statusTone}`}
          >
            {statusLabel(row.status)}
          </span>
        </div>
        {row.camera_model ? (
          <p className="text-xs text-zinc-500 dark:text-gray-500 mt-2">
            {serviceTypeLabel(row.service_type)}
            {row.service_type && row.camera_model ? ' · ' : ''}
            {row.camera_model}
          </p>
        ) : null}
      </div>

      <div className="px-4 py-5 sm:px-6 space-y-5">
        <ProgressTracker status={row.status} appointmentDate={row.appointment_date} />

        <div className="grid gap-4 md:grid-cols-2">
          <AppointmentPanel row={row} />
          <DealerContactPanel row={row} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <WarrantyPanel row={row} />
          <CameraInfoPanel row={row} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DocumentsPanel row={row} />
          <PortalContactPanel contact={portalContact ?? null} />
        </div>

        {row.completed_at ? (
          <p className="text-xs text-zinc-500 dark:text-gray-500">
            Completed{' '}
            {formatInTimeZone(new Date(row.completed_at), tz, 'MMMM d, yyyy')}
            {row.specialist_name ? ` · Specialist: ${row.specialist_name}` : ''}
          </p>
        ) : null}

        <RatingPanel
          vinQuery={effectiveVinQuery}
          demandNumber={row.demand_number}
          specialistName={row.specialist_name || 'Your specialist'}
          ratedCustomerRating={row.rated_customer_rating}
          ratedQualityScore={row.rated_quality_score}
          ratedComment={row.rated_comment || ''}
          canRate={row.can_rate}
          onRated={(cr, qs, c) => onRated(rowIndex, cr, qs, c)}
        />

        <ServiceRecordPanel
          vinQuery={effectiveVinQuery}
          demandNumber={row.demand_number}
          status={row.status}
          refreshToken={serviceRecordsRefreshToken}
        />
      </div>
    </article>
  )
}

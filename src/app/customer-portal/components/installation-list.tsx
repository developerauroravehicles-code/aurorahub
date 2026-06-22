'use client'

import type { CustomerPortalRow } from '@/types/customer-portal'
import { groupInstallations, rowKey } from '@/lib/customer-portal-utils'
import { InstallationCard } from './installation-card'

type Props = {
  rows: CustomerPortalRow[]
  vinQuery: string
  serviceRecordsRefreshToken?: number
  onRated: (index: number, customerRating: number, qualityScore: number, comment: string) => void
}

function Section({
  title,
  subtitle,
  items,
  vinQuery,
  serviceRecordsRefreshToken,
  onRated,
}: {
  title: string
  subtitle?: string
  items: { row: CustomerPortalRow; index: number }[]
  vinQuery: string
  serviceRecordsRefreshToken?: number
  onRated: Props['onRated']
}) {
  if (items.length === 0) return null
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">{title}</h2>
        {subtitle ? <p className="text-sm text-zinc-500 dark:text-gray-500 mt-0.5">{subtitle}</p> : null}
      </div>
      <div className="space-y-5">
        {items.map(({ row, index }) => (
          <InstallationCard
            key={rowKey(row, index)}
            row={row}
            rowIndex={index}
            vinQuery={vinQuery}
            serviceRecordsRefreshToken={serviceRecordsRefreshToken}
            onRated={onRated}
          />
        ))}
      </div>
    </div>
  )
}

export function InstallationList({
  rows,
  vinQuery,
  serviceRecordsRefreshToken,
  onRated,
}: Props) {
  const { active, past } = groupInstallations(rows)

  return (
    <div className="space-y-8">
      <Section
        title="Active installations"
        subtitle="Upcoming or in-progress dashcam appointments"
        items={active}
        vinQuery={vinQuery}
        serviceRecordsRefreshToken={serviceRecordsRefreshToken}
        onRated={onRated}
      />
      <Section
        title="Past installations"
        subtitle="Completed work and warranty information"
        items={past}
        vinQuery={vinQuery}
        serviceRecordsRefreshToken={serviceRecordsRefreshToken}
        onRated={onRated}
      />
    </div>
  )
}

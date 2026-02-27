'use server'

import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from 'date-fns'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import type { ExportReportOptions, ReportDemandRow } from './export-report-pdf'

export type ReportScope = 'sales' | 'finance' | 'admin' | 'specialist'
export type ReportPeriod = 'daily' | 'weekly' | 'monthly'

function getDateRange(period: ReportPeriod): { start: Date; end: Date } {
  const now = new Date()
  switch (period) {
    case 'daily':
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      }
    case 'weekly':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      }
    case 'monthly':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      }
    default:
      return { start: startOfDay(now), end: endOfDay(now) }
  }
}

function getPeriodLabel(period: ReportPeriod, start: Date, end: Date): string {
  return `${formatInTimeZone(start, SYSTEM_DEFAULT_TIMEZONE, 'MMM d, yyyy')} - ${formatInTimeZone(end, SYSTEM_DEFAULT_TIMEZONE, 'MMM d, yyyy')}`
}

export async function resolveReportData(
  scope: ReportScope,
  period: ReportPeriod,
  dealerId?: string
): Promise<{ options: ExportReportOptions; error?: string }> {
  const supabase = await createClient()
  const { start, end } = getDateRange(period)
  const rangeStart = start.toISOString()
  const rangeEnd = end.toISOString()

  let query = supabase
    .from('demands')
    .select(
      'id, demand_number, status, created_at, camera_model, vehicle_make, vehicle_model, vehicle_year, appointment_date, dealer_id, assigned_specialist_id, assigned_finance_id, created_by, customer_firstname, customer_lastname, dealers(region_codes(timezone_id, timezones(name)))'
    )
    .gte('created_at', rangeStart)
    .lte('created_at', rangeEnd)

  if (dealerId?.trim()) {
    query = query.eq('dealer_id', dealerId.trim())
  }

  switch (scope) {
    case 'sales':
      {
        const { data: salesProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'sales')
        const ids = salesProfiles?.map((p) => p.id) ?? []
        if (ids.length > 0) query = query.in('created_by', ids)
        else query = query.eq('created_by', 'no-match')
      }
      break
    case 'finance':
      query = query.not('assigned_finance_id', 'is', null)
      break
    case 'specialist':
      query = query.not('assigned_specialist_id', 'is', null)
      break
    case 'admin':
    default:
      break
  }

  const { data: demandsData, error } = await query.order('created_at', { ascending: false })

  if (error) return { options: {} as ExportReportOptions, error: error.message }

  const demands = demandsData ?? []

  const cameraCounts: Record<string, number> = {}
  const statusCounts: Record<string, number> = {}
  const vehicleMakeCounts: Record<string, number> = {}

  for (const d of demands) {
    const camera = d.camera_model || 'Unknown'
    cameraCounts[camera] = (cameraCounts[camera] || 0) + 1
    const status = d.status || 'unknown'
    statusCounts[status] = (statusCounts[status] || 0) + 1
    const make = d.vehicle_make || 'Unknown'
    vehicleMakeCounts[make] = (vehicleMakeCounts[make] || 0) + 1
  }

  const getTz = (d: { dealers?: { region_codes?: { timezones?: { name: string } } } } | null) =>
    d?.dealers && typeof d.dealers === 'object' && !Array.isArray(d.dealers)
      ? (d.dealers as { region_codes?: { timezones?: { name: string } } }).region_codes?.timezones?.name ?? SYSTEM_DEFAULT_TIMEZONE
      : SYSTEM_DEFAULT_TIMEZONE

  const reportRows: ReportDemandRow[] = demands.map((d: Record<string, unknown>) => {
    const tz = getTz(d as Parameters<typeof getTz>[0])
    return {
      customer: `${(d.customer_firstname as string) ?? ''} ${(d.customer_lastname as string) ?? ''}`.trim() || 'Unknown',
      vehicle: `${(d.vehicle_year as number) ?? ''} ${(d.vehicle_make as string) ?? ''} ${(d.vehicle_model as string) ?? ''}`.trim() || 'Unknown',
      camera: (d.camera_model as string) ?? 'Unknown',
      appointment: formatInTimeZone(
        new Date(d.appointment_date as string),
        tz,
        'MMM d, yyyy h:mm a'
      ),
      status: String(d.status ?? ''),
      created: formatInTimeZone(new Date(d.created_at as string), tz, 'MMM d, yyyy'),
    }
  })

  const reportTitle = `${scope.charAt(0).toUpperCase() + scope.slice(1)} ${period.charAt(0).toUpperCase() + period.slice(1)} Report`

  const options: ExportReportOptions = {
    reportTitle,
    dateRange: getPeriodLabel(period, start, end),
    exporterFullName: 'AuroraHub System',
    exporterEmail: 'system@aurorahub',
    appliedFilters: dealerId ? [`Dealer: ${dealerId}`] : undefined,
    totalDemands: demands.length,
    totalAppointments: demands.length,
    cameraCounts,
    statusCounts,
    vehicleMakeCounts,
    demands: reportRows,
  }

  return { options }
}

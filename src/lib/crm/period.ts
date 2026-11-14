import { getDateRangeInTimezone } from '@/lib/timezone-defaults'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'

export type CrmQuarter = 1 | 2 | 3 | 4 | 'all'

export type CrmPeriod = {
  year: number
  quarter: CrmQuarter
  dateFrom: string
  dateTo: string
  label: string
}

const QUARTER_MONTHS: Record<1 | 2 | 3 | 4, { startMonth: number; endMonth: number; label: string }> = {
  1: { startMonth: 1, endMonth: 3, label: 'Q1' },
  2: { startMonth: 4, endMonth: 6, label: 'Q2' },
  3: { startMonth: 7, endMonth: 9, label: 'Q3' },
  4: { startMonth: 10, endMonth: 12, label: 'Q4' },
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate()
}

export function resolveCrmPeriod(year: number, quarter: CrmQuarter): CrmPeriod {
  if (quarter === 'all') {
    const dateFrom = `${year}-01-01`
    const dateTo = `${year}-12-31`
    return {
      year,
      quarter,
      dateFrom,
      dateTo,
      label: `${year} (full year)`,
    }
  }

  const q = QUARTER_MONTHS[quarter]
  const dateFrom = `${year}-${String(q.startMonth).padStart(2, '0')}-01`
  const last = lastDayOfMonth(year, q.endMonth)
  const dateTo = `${year}-${String(q.endMonth).padStart(2, '0')}-${String(last).padStart(2, '0')}`

  return {
    year,
    quarter,
    dateFrom,
    dateTo,
    label: `${year} ${q.label}`,
  }
}

export function crmPeriodIsoBounds(period: CrmPeriod): { startIso: string; endIso: string } {
  const { start, end } = getDateRangeInTimezone(period.dateFrom, period.dateTo, SYSTEM_DEFAULT_TIMEZONE)
  return { startIso: start, endIso: end }
}

export function parseCrmPeriodFromSearchParams(
  yearRaw?: string | null,
  quarterRaw?: string | null
): CrmPeriod {
  const now = new Date()
  const defaultYear = now.getFullYear()
  const year = yearRaw && /^\d{4}$/.test(yearRaw) ? parseInt(yearRaw, 10) : defaultYear

  let quarter: CrmQuarter = 'all'
  if (quarterRaw === '1' || quarterRaw === '2' || quarterRaw === '3' || quarterRaw === '4') {
    quarter = parseInt(quarterRaw, 10) as 1 | 2 | 3 | 4
  } else if (quarterRaw === 'all') {
    quarter = 'all'
  } else {
    const month = now.getMonth() + 1
    if (month <= 3) quarter = 1
    else if (month <= 6) quarter = 2
    else if (month <= 9) quarter = 3
    else quarter = 4
  }

  return resolveCrmPeriod(year, quarter)
}
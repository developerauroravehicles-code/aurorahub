/**
 * Gregorian calendar helpers for month grids. Wall dates (yyyy-MM-dd) match a physical
 * calendar regardless of viewer timezone — use with Pacific interpreting instants via toDate().
 */

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function utcDaysInGregorianMonth(year: number, month1based: number): number {
  return new Date(Date.UTC(year, month1based, 0)).getUTCDate()
}

/** Add signed whole days on the proleptic Gregorian wall calendar (UTC date math). */
export function utcWallDateAddDays(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays))
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

export type GregorianGridDay = { ymd: string; inMonth: boolean }

/** Monday-first 6-row grid covering `year`/`month`. */
export function gregorianMondayFirstGrid(year: number, month1based: number): GregorianGridDay[] {
  const firstOfMonth = `${year}-${pad2(month1based)}-01`
  const jsDowSun0 = new Date(Date.UTC(year, month1based - 1, 1)).getUTCDay()
  const offsetMonday = (jsDowSun0 + 6) % 7
  let cursor = utcWallDateAddDays(firstOfMonth, -offsetMonday)
  const out: GregorianGridDay[] = []
  const prefix = `${year}-${pad2(month1based)}`
  for (let i = 0; i < 42; i++) {
    out.push({
      ymd: cursor,
      inMonth: cursor.startsWith(`${prefix}-`),
    })
    cursor = utcWallDateAddDays(cursor, 1)
  }
  return out
}

export function addGregorianMonths(year: number, month1based: number, deltaMonths: number): { y: number; m: number } {
  const dt = new Date(Date.UTC(year, month1based - 1 + deltaMonths, 1))
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1 }
}

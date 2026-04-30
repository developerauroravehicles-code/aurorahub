/** Strip to digits only (for phone comparisons). */
function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

/** Collapse whitespace for name matching. */
function normalizeNamePiece(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Normalize VIN-style input: A–Z + 0–9, no spaces; uppercase.
 */
function normalizeVinQuery(raw: string): string {
  return raw.replace(/\s/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export type DemandSmartSearchRow = {
  customer_firstname: string | null | undefined
  customer_lastname: string | null | undefined
  customer_phone?: string | null
  vin_last6?: string | null
  stock_number?: string | null
  demand_number?: string | number | null
}
/** True if trimmed query has meaningful length for search (avoid 1-char noise). */
function queryIsActive(trimmed: string): boolean {
  const significantLen = trimmed.replace(/\s/g, '').length
  const queryDigits = digitsOnly(trimmed)
  const digitsOnlyLen = queryDigits.length
  const digitsOrPhoneFormatting = /^[\d\s\-().+]+$/.test(trimmed)
  return significantLen >= 3 || (digitsOrPhoneFormatting && digitsOnlyLen >= 3)
}

function matchesName(row: DemandSmartSearchRow, trimmed: string): boolean {
  const first = (row.customer_firstname ?? '').toLowerCase()
  const last = (row.customer_lastname ?? '').toLowerCase()
  const consecutive = `${first}${last}`.replace(/\s/g, '')
  const spaced = normalizeNamePiece(`${first} ${last}`)
  const qCompact = trimmed.toLowerCase().replace(/\s/g, '')
  const qSpaced = normalizeNamePiece(trimmed)
  if (
    consecutive.includes(qCompact) ||
    spaced.includes(qCompact) ||
    spaced.includes(qSpaced)
  ) {
    return true
  }
  const words = qSpaced.split(/\s+/).filter(w => w.length >= 2)
  if (words.length >= 2) {
    const inFull = normalizeNamePiece(`${first} ${last}`)
    return words.every(w => inFull.includes(w))
  }
  return false
}

function matchesPhone(row: DemandSmartSearchRow, trimmed: string): boolean {
  let queryDigits = digitsOnly(trimmed)
  if (queryDigits.length < 3) return false
  let phoneDigits = digitsOnly(row.customer_phone ?? '')
  if (phoneDigits.length === 0) return false
  if (queryDigits.length === 11 && queryDigits.startsWith('1')) queryDigits = queryDigits.slice(1)
  if (phoneDigits.length === 11 && phoneDigits.startsWith('1')) phoneDigits = phoneDigits.slice(1)
  if (queryDigits.length >= 10) {
    const q10 = queryDigits.slice(-10)
    return phoneDigits === queryDigits || phoneDigits.endsWith(q10) || q10 === phoneDigits
  }
  return phoneDigits.includes(queryDigits)
}

function matchesVin(row: DemandSmartSearchRow, trimmed: string): boolean {
  const vinStored = (row.vin_last6 ?? '').replace(/\s/g, '').toUpperCase()
  if (vinStored.length === 0) return false
  const vinNorm = normalizeVinQuery(trimmed)
  if (vinNorm.length < 3) return false
  const tail = vinNorm.length <= 6 ? vinNorm : vinNorm.slice(-6)
  if (tail.length < 3) return false
  return (
    vinStored === tail ||
    vinStored.includes(tail) ||
    tail.includes(vinStored)
  )
}

function matchesStock(row: DemandSmartSearchRow, trimmed: string): boolean {
  const stock = (row.stock_number ?? '').toLowerCase().replace(/\s/g, '')
  if (stock.length === 0) return false
  const q = trimmed.toLowerCase().replace(/\s/g, '')
  return q.length >= 3 && stock.includes(q)
}

/** Demand reference (e.g. ARR…) — substring match either direction. */
function matchesDemandNumber(row: DemandSmartSearchRow, trimmed: string): boolean {
  const raw = row.demand_number
  if (raw == null || String(raw).trim() === '') return false
  const dn = String(raw).toLowerCase().replace(/\s/g, '')
  const q = trimmed.toLowerCase().replace(/\s/g, '')
  if (q.length < 2) return false
  return dn.includes(q)
}

/**
 * Single-field search: name, phone, VIN last 6, stock, and demand reference number (when present).
 * Empty/whitespace query matches all rows. Short fuzzy text (below threshold) skips filtering.
 */
export function demandMatchesSmartSearch(row: DemandSmartSearchRow, raw: string): boolean {
  const trimmed = raw.trim()
  if (trimmed === '') return true
  if (!queryIsActive(trimmed)) return true

  return (
    matchesName(row, trimmed) ||
    matchesPhone(row, trimmed) ||
    matchesVin(row, trimmed) ||
    matchesStock(row, trimmed) ||
    matchesDemandNumber(row, trimmed)
  )
}

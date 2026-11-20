import { modelYearHintFromVin } from './vin-model-year'

export type NhtsaVinDecode = {
  make: string
  model: string
  modelYear: string
  trim: string
  series: string
  errorCode: string
  errorText: string
}

const VPIC_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles'

/** Strip spaces/dashes, uppercase; VIN must be 17 chars without I, O, Q. */
export function normalizeVinInput(raw: string): string {
  return raw.trim().replace(/[\s-]/g, '').toUpperCase()
}

export function validateVinFormat(vin: string): { ok: true; vin: string } | { error: string } {
  const normalized = normalizeVinInput(vin)
  if (normalized.length !== 17) {
    return { error: 'VIN must be exactly 17 characters (letters and digits).' }
  }
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) {
    return { error: 'VIN cannot contain I, O, or Q, and must use only letters and digits.' }
  }
  return { ok: true, vin: normalized }
}

export function isNhtsaDecodeUncertain(decode: NhtsaVinDecode): boolean {
  const code = decode.errorCode.trim()
  return code !== '' && code !== '0'
}

function pickString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key]
  if (v == null) return ''
  const s = String(v).trim()
  return s && s.toLowerCase() !== 'null' ? s : ''
}

function parseDecodeRow(row: Record<string, unknown>): NhtsaVinDecode {
  const errorCode = pickString(row, 'ErrorCode')
  const errorText = pickString(row, 'ErrorText')
  const make = pickString(row, 'Make')

  if (errorCode && errorCode !== '0' && !make) {
    throw new Error(errorText || 'VIN could not be decoded')
  }
  if (!make) {
    throw new Error('VIN not found or invalid — no vehicle make returned')
  }

  return {
    make,
    model: pickString(row, 'Model'),
    modelYear: pickString(row, 'ModelYear'),
    trim: pickString(row, 'Trim'),
    series: pickString(row, 'Series2') || pickString(row, 'Series'),
    errorCode,
    errorText,
  }
}

async function fetchDecodeOnce(vin: string, signal: AbortSignal, modelYear?: number | null): Promise<NhtsaVinDecode> {
  const params = new URLSearchParams({ format: 'json' })
  if (modelYear != null && modelYear >= 1980 && modelYear <= 2100) {
    params.set('modelyear', String(modelYear))
  }
  const url = `${VPIC_BASE}/DecodeVinValues/${encodeURIComponent(vin)}?${params.toString()}`
  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`NHTSA vPIC returned HTTP ${res.status}`)
  }

  const json = (await res.json()) as {
    Results?: Array<Record<string, unknown>>
  }

  const row = json.Results?.[0]
  if (!row) {
    throw new Error('No decode result from NHTSA')
  }

  return parseDecodeRow(row)
}

/** Decode a 17-character VIN via NHTSA vPIC (intended for server-side calls). */
export async function decodeVinFromNhtsa(vin: string): Promise<NhtsaVinDecode> {
  const validated = validateVinFormat(vin)
  if ('error' in validated) {
    throw new Error(validated.error)
  }

  const modelYearHint = modelYearHintFromVin(validated.vin)
  const timeoutMs = 12000
  let lastError: Error | null = null

  const attempts: Array<number | null> = [modelYearHint, null]

  for (let attempt = 0; attempt < attempts.length; attempt++) {
    const modelYear = attempts[attempt]
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const result = await fetchDecodeOnce(validated.vin, controller.signal, modelYear)
      return result
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (lastError.name === 'AbortError') {
        lastError = new Error('NHTSA lookup timed out — try again')
      }
      const msg = lastError.message.toLowerCase()
      if (msg.includes('http 429') || msg.includes('http 5')) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
      }
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError ?? new Error('VIN decode failed')
}
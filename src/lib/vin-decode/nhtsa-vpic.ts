export type NhtsaVinDecode = {
  make: string
  model: string
  modelYear: string
  trim: string
  series: string
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

function pickString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key]
  if (v == null) return ''
  const s = String(v).trim()
  return s && s.toLowerCase() !== 'null' ? s : ''
}

async function fetchDecodeOnce(vin: string, signal: AbortSignal): Promise<NhtsaVinDecode> {
  const url = `${VPIC_BASE}/DecodeVinValues/${encodeURIComponent(vin)}?format=json`
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
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

  const errorCode = pickString(row, 'ErrorCode')
  const errorText = pickString(row, 'ErrorText')
  if (errorCode && errorCode !== '0' && !pickString(row, 'Make')) {
    throw new Error(errorText || 'VIN could not be decoded')
  }

  const make = pickString(row, 'Make')
  if (!make) {
    throw new Error('VIN not found or invalid — no vehicle make returned')
  }

  return {
    make,
    model: pickString(row, 'Model'),
    modelYear: pickString(row, 'ModelYear'),
    trim: pickString(row, 'Trim'),
    series: pickString(row, 'Series'),
  }
}

/** Decode a 17-character VIN via NHTSA vPIC (server-side only). */
export async function decodeVinFromNhtsa(vin: string): Promise<NhtsaVinDecode> {
  const validated = validateVinFormat(vin)
  if ('error' in validated) {
    throw new Error(validated.error)
  }

  const timeoutMs = 15000
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const result = await fetchDecodeOnce(validated.vin, controller.signal)
      return result
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (lastError.name === 'AbortError') {
        lastError = new Error('NHTSA lookup timed out — try again')
      }
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError ?? new Error('VIN decode failed')
}

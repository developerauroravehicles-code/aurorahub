import { VEHICLE_MAKES_CA } from '@/lib/vehicle-makes'
import { getModelsForMake } from '@/lib/vehicle-models'

function normalizeToken(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Digit-for-letter swaps OCR commonly makes in uppercase form text. */
function deglitchToken(token: string): string {
  return token
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/5/g, 'S')
    .replace(/6/g, 'G')
    .replace(/8/g, 'B')
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0]
    previous[0] = i
    for (let j = 1; j <= b.length; j++) {
      const substitution = diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      diagonal = previous[j]
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, substitution)
    }
  }
  return previous[b.length]
}

/** Edit-distance budget scaled to token length; short names stay exact. */
function fuzzyLimit(length: number): number {
  if (length >= 8) return 2
  if (length >= 5) return 1
  return 0
}

/**
 * Match OCR make text to a known Canada-market make. Tolerates OCR garbles
 * ("N1SSAN", "NISSAM") so the Make dropdown can still be auto-selected.
 */
export function normalizeMake(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const token = normalizeToken(trimmed)
  if (!token) return null
  const variants = [...new Set([token, deglitchToken(token)])]

  for (const make of VEHICLE_MAKES_CA) {
    const makeToken = normalizeToken(make)
    if (variants.includes(makeToken)) return make
  }

  // Length guards keep short fragments like "VIN" from matching into
  // longer makes ("VINFAST") and vice versa.
  for (const make of VEHICLE_MAKES_CA) {
    const makeToken = normalizeToken(make)
    if (
      variants.some(
        (variant) =>
          (makeToken.length >= 4 && variant.includes(makeToken)) ||
          (variant.length >= 5 && makeToken.includes(variant))
      )
    ) {
      return make
    }
  }

  let best: { make: string; distance: number } | null = null
  for (const make of VEHICLE_MAKES_CA) {
    const makeToken = normalizeToken(make)
    const limit = fuzzyLimit(makeToken.length)
    if (limit === 0) continue
    for (const variant of variants) {
      const distance = levenshtein(variant, makeToken)
      if (distance <= limit && (!best || distance < best.distance)) {
        best = { make, distance }
      }
    }
  }

  return best?.make ?? null
}

export type NormalizedModelMatch = {
  model: string | null
  useCustom: boolean
}

function matchModelToken(models: string[], raw: string): string | null {
  const token = normalizeToken(raw)
  if (!token) return null
  const variants = [...new Set([token, deglitchToken(token)])]

  for (const model of models) {
    if (variants.includes(normalizeToken(model))) return model
  }

  for (const model of models) {
    const modelToken = normalizeToken(model)
    if (
      variants.some(
        (variant) =>
          (modelToken.length >= 4 && variant.includes(modelToken)) ||
          (variant.length >= 5 && modelToken.includes(variant))
      )
    ) {
      return model
    }
  }

  let best: { model: string; distance: number } | null = null
  for (const model of models) {
    const modelToken = normalizeToken(model)
    const limit = fuzzyLimit(modelToken.length)
    if (limit === 0) continue
    for (const variant of variants) {
      const distance = levenshtein(variant, modelToken)
      if (distance <= limit && (!best || distance < best.distance)) {
        best = { model, distance }
      }
    }
  }

  return best?.model ?? null
}

/** Match OCR model text to a known model for the given make, garble-tolerant. */
export function normalizeModel(make: string, raw: string): NormalizedModelMatch {
  const trimmed = raw.trim()
  if (!trimmed) return { model: null, useCustom: false }

  const models = getModelsForMake(make)
  const matched =
    matchModelToken(models, trimmed) ??
    matchModelToken(models, trimmed.split(/\s+/)[0] ?? trimmed)

  if (matched) return { model: matched, useCustom: false }

  return { model: trimmed, useCustom: true }
}

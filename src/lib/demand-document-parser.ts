import { formatCanadianPhone, parseCanadianPhone } from '@/components/canadian-phone-input'
import {
  createEmptyExtractResult,
  type DemandDocumentType,
  type DemandExtractResult,
  type ExtractedField,
} from '@/lib/demand-extract-types'
import { levenshtein, normalizeMake, normalizeModel } from '@/lib/normalize-vehicle-fields'
import { VEHICLE_MAKES_CA } from '@/lib/vehicle-makes'

const PHONE_REGEX = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g
const CHECKLIST_STOCK_PATTERN = /\b(\d[A-Z]{1,2}\d{3,5})\b/

/**
 * Form labels and boilerplate that OCR frequently returns in place of a real
 * value, because label and value cells bleed into each other.
 */
const BOILERPLATE_WORDS = new Set([
  'ADDRESS',
  'APPLICANT',
  'BIRTH',
  'CELL',
  'CITY',
  'CLEAR',
  'COPY',
  'CORRESPONDENCE',
  'CREDIT',
  'CUSTOMER',
  'DATE',
  'DEAL',
  'DEPOSIT',
  'DESCRIPTION',
  'DIRECTION',
  'DOB',
  'DURATION',
  'EMAIL',
  'FAX',
  'ENGLISH',
  'FEMALE',
  'FIRST',
  'FRENCH',
  'GENDER',
  'LANGUAGE',
  'LAST',
  'LENDERS',
  'LOOKUP',
  'MALE',
  'MANAGER',
  'MANUALLY',
  'MARITAL',
  'MARRIED',
  'MIDDLE',
  'MOBILE',
  'MONTHS',
  'NAME',
  'NOTES',
  'NUMBER',
  'ONLY',
  'PHONE',
  'POSTAL',
  'PRIMARY',
  'PROVINCE',
  'RELATION',
  'REPORT',
  'PULL',
  'SALES',
  'SALUTATION',
  'SIN',
  'SINGLE',
  'SSN',
  'STATUS',
  'STOCK',
  'STREET',
  'SUFFIX',
  'SUITE',
  'TRADE',
  'TYPE',
  'VEHICLE',
  'VIN',
  'YEARS',
])

function field(value: string | null, confidence: ExtractedField['confidence']): ExtractedField {
  const trimmed = value?.trim() ?? null
  if (!trimmed) return { value: null, confidence: 'missing' }
  return { value: trimmed, confidence }
}

function emptyVehicle(): { year: ExtractedField; make: ExtractedField; model: ExtractedField } {
  return {
    year: field(null, 'missing'),
    make: field(null, 'missing'),
    model: field(null, 'missing'),
  }
}

function normalizeOcrText(text: string): string {
  // Pipes are form cell borders, not letters; gluing them onto values as "I"
  // corrupted names ("|LOEPPKY" became "ILOEPPKY").
  return text.replace(/\r\n/g, '\n').replace(/[|[\]]/g, ' ').trim()
}

function compactText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isBoilerplate(value: string): boolean {
  const token = value.trim().toUpperCase().replace(/[^A-Z]/g, '')
  if (!token) return true
  if (BOILERPLATE_WORDS.has(token)) return true
  return VEHICLE_MAKES_CA.some((make) => make.toUpperCase().replace(/[^A-Z]/g, '') === token)
}

function detectDocumentType(text: string): DemandDocumentType {
  const upper = compactText(text).toUpperCase()
  const looksLikeApplication =
    upper.includes('PRIMARY APPLICANT') ||
    upper.includes('DATE OF BIRTH') ||
    upper.includes('MOBILE PHONE') ||
    upper.includes('MARITAL STATUS') ||
    upper.includes('PULL CREDIT REPORT')

  if (
    upper.includes('SALES MANAGER CHECK LIST') ||
    upper.includes('SALES MANAGER CHECKLIST') ||
    upper.includes('CUSTOMER LAST NAME') ||
    (upper.includes('STOCK') && upper.includes('VEHICLE DESCRIPTION')) ||
    (upper.includes('DEAL') && upper.includes('STOCK') && !looksLikeApplication)
  ) {
    return 'sales_checklist'
  }

  if (looksLikeApplication && upper.includes('LAST NAME')) {
    return 'credit_application'
  }

  return 'unknown'
}

function extractAfterLabel(text: string, labelPattern: RegExp): string | null {
  const match = compactText(text).match(labelPattern)
  return match?.[1]?.trim() ?? null
}

function extractFromLines(text: string, label: RegExp, valuePattern: RegExp): string | null {
  const linePattern = new RegExp(`(?:${label.source})\\s*[:#-]?\\s*(${valuePattern.source})`, 'i')
  for (const line of lines(text)) {
    const normalizedLine = line.replace(/\s+/g, ' ')
    const inline = normalizedLine.match(linePattern)
    if (inline?.[1]) return inline[1].trim()
  }
  return null
}

function cleanVinToken(raw: string): string {
  return raw.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase().replace(/O/g, '0').replace(/I/g, '1')
}

function isPlausibleVin(token: string): boolean {
  if (token.length < 15 || token.length > 17) return false
  const letters = (token.match(/[A-Z]/g) ?? []).length
  const digits = (token.match(/[0-9]/g) ?? []).length
  if (letters < 4 || digits < 4) return false
  return ![...BOILERPLATE_WORDS].some((word) => word.length >= 4 && token.includes(word))
}

function collectVinCandidates(text: string): string[] {
  const candidates: string[] = []
  const labeled = extractAfterLabel(text, /VIN\s*[:\s#]*([A-HJ-NPR-Z0-9IO\s-]{6,22})/i)
  if (labeled) candidates.push(cleanVinToken(labeled))

  for (const target of [compactText(text), compactText(text).replace(/\s/g, '')]) {
    for (const match of target.matchAll(/\b([A-HJ-NPR-Z0-9IO]{17})\b/gi)) {
      candidates.push(cleanVinToken(match[1]))
    }
    for (const match of target.matchAll(/VIN\s*[:\s#-]*([A-HJ-NPR-Z0-9IO\s-]{10,22})/gi)) {
      candidates.push(cleanVinToken(match[1]))
    }
  }

  return candidates.filter(isPlausibleVin)
}

function extractVinLast6(text: string): ExtractedField {
  const candidates = collectVinCandidates(text)
  if (candidates.length === 0) return field(null, 'missing')

  const bestVin = candidates.sort((a, b) => b.length - a.length)[0]
  return field(bestVin.slice(-6), 'high')
}

function isNorthAmericanPhone(digits: string): boolean {
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits)
}

/**
 * Only accepts numbers that appear as one uninterrupted token. Scanning every
 * digit in the document instead stitched unrelated values (dates, postal and
 * street numbers) into a plausible looking phone number.
 */
function extractAllPhones(text: string): string[] {
  const compact = compactText(text)
  const found: string[] = []

  for (const match of compact.matchAll(PHONE_REGEX)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (/\d/.test(compact[start - 1] ?? '')) continue
    if (/\d/.test(compact[end] ?? '')) continue

    if (isNorthAmericanPhone(parseCanadianPhone(match[0]))) {
      found.push(match[0])
    }
  }

  return found
}

function extractLabelledPhone(text: string): string | null {
  const candidate =
    extractAfterLabel(text, /(?:Mobile\s+Ph[o0e]n[es]?|Phone)\s*#?\s*[:\s]*([\d()\s.-]{10,})/i) ??
    extractFromLines(text, /Mobile\s+Ph[o0e]n[es]?|Phone/i, /[\d()\s.-]{10,}/)

  if (!candidate) return null
  return isNorthAmericanPhone(parseCanadianPhone(candidate)) ? candidate : null
}

function extractPhone(text: string): ExtractedField {
  const labeled = extractLabelledPhone(text)
  const candidates = labeled ? [labeled, ...extractAllPhones(text)] : extractAllPhones(text)
  if (candidates.length === 0) return field(null, 'missing')

  const digits = parseCanadianPhone(candidates[0])
  const wellFormatted = /^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(candidates[0].trim())
  // Application forms repeat the number in the Phone and Mobile Phone cells.
  const repeated = candidates.filter((candidate) => parseCanadianPhone(candidate) === digits).length > 1

  return field(formatCanadianPhone(digits), labeled || wellFormatted || repeated ? 'high' : 'low')
}

function extractStockNumber(text: string, allowLoose: boolean): ExtractedField {
  const labeled =
    extractAfterLabel(text, /St[o0]ck\s*(?:#|N[o0]\.?|Number)?\s*[:\s]*([A-Za-z0-9-]{3,10})/i) ??
    extractFromLines(text, /St[o0]ck\s*(?:#|N[o0]\.?|Number)?/i, /[A-Za-z0-9-]{3,10}/)

  if (labeled && !isBoilerplate(labeled)) {
    return field(labeled.toUpperCase(), 'high')
  }

  if (allowLoose) {
    const loose = compactText(text).toUpperCase().match(CHECKLIST_STOCK_PATTERN)
    if (loose?.[1]) return field(loose[1], 'low')
  }

  return field(null, 'missing')
}

function buildModelField(make: string, rawModel: string | null): ExtractedField {
  if (!rawModel) return field(null, 'missing')

  const cleaned = rawModel.trim().replace(/\s{2,}/g, ' ')
  if (!cleaned) return field(null, 'missing')
  if (cleaned.split(/\s+/).some((word) => isBoilerplate(word))) return field(null, 'missing')

  const { model, useCustom } = normalizeModel(make, cleaned)
  if (!model) return field(null, 'missing')
  // Always keep canonical list casing so the Model dropdown can auto-select.
  return field(model, useCustom ? 'low' : 'high')
}

/** Checklist OCR often puts year/make/model on the line after the label. */
function extractVehicleDescriptionLine(text: string): string | null {
  const allLines = lines(text)
  for (let index = 0; index < allLines.length; index++) {
    const line = allLines[index]
    if (!/Vehicle\s+Descriptions?/i.test(line)) continue

    const inline = line.replace(/^.*Vehicle\s+Descriptions?\s*[:\s]*/i, '').trim()
    if (/\b(?:19|20)\d{2}\b/.test(inline) || normalizeMake(inline.split(/\s+/)[0] ?? '')) {
      return inline
    }

    for (let offset = 1; offset <= 2; offset++) {
      const next = allLines[index + offset]
      if (!next) break
      if (/\b(?:19|20)\d{2}\b/.test(next) || VEHICLE_MAKES_CA.some((make) => next.toUpperCase().includes(make.toUpperCase()))) {
        return next.replace(/\s{2,}/g, ' ').trim()
      }
    }
  }
  return null
}

/** Matches "2026 NISSAN KICKS" even when label/value cells sit on separate lines. */
function extractYearMakeModelLine(text: string): {
  year: ExtractedField
  make: ExtractedField
  model: ExtractedField
} | null {
  for (const line of lines(text)) {
    const match = line.match(/\b((?:19|20)\d{2})\s+([A-Za-z][A-Za-z0-9-]*)\s+([A-Za-z][A-Za-z0-9-]*)/)
    if (!match) continue

    const [, year, makeRaw, modelRaw] = match
    const make = normalizeMake(makeRaw)
    if (!make) continue

    return {
      year: field(year, 'high'),
      make: field(make, 'high'),
      model: buildModelField(make, modelRaw),
    }
  }
  return null
}

function parseYearMakeModel(source: string): {
  year: ExtractedField
  make: ExtractedField
  model: ExtractedField
} | null {
  const match = source.match(/\b((?:19|20)\d{2})\s+([A-Za-z][A-Za-z0-9-]*)\s+(.+?)(?:\s+VIN|\s+STOCK|$)/i)
  if (!match) return null

  const [, year, makeRaw, modelRaw] = match
  const normalizedMake = normalizeMake(makeRaw)
  if (!normalizedMake) return null

  return {
    year: field(year, 'high'),
    make: field(normalizedMake, 'high'),
    model: buildModelField(normalizedMake, modelRaw),
  }
}

/** Handles descriptions without a leading year, e.g. "NISSAN KICKS 2026". */
function parseMakeFirstDescription(source: string): {
  year: ExtractedField
  make: ExtractedField
  model: ExtractedField
} | null {
  const words = source.toUpperCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null

  // Single word first so "NISSAN KICKS" resolves to make Nissan + model
  // Kicks instead of the two-word candidate swallowing the model.
  for (const take of [1, 2]) {
    if (words.length < take) continue
    const make = normalizeMake(words.slice(0, take).join(' '))
    if (!make) continue

    const makeToken = make.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const rest = words
      .slice(take)
      .filter((word) => !makeToken.includes(word.replace(/[^A-Z0-9]/g, '')))
    const year = rest.find((word) => /^(?:19|20)\d{2}$/.test(word)) ?? null
    const modelRaw = rest.filter((word) => !/^(?:19|20)\d{2}$/.test(word)).join(' ') || null

    return {
      year: field(year, 'high'),
      make: field(make, 'high'),
      model: buildModelField(make, modelRaw),
    }
  }

  return null
}

function findKnownMake(
  haystack: string,
  text: string
): { make: string; index: number; matchLength: number } | null {
  const candidates: Array<{ make: string; index: number; matchLength: number; score: number }> = []
  const sortedMakes = [...VEHICLE_MAKES_CA].sort((a, b) => b.length - a.length)

  for (const make of sortedMakes) {
    const token = make.toUpperCase().replace(/[^A-Z0-9]+/g, ' ')
    const pattern = new RegExp(`\\b${escapeRegex(token)}\\b`, 'g')
    for (const match of haystack.matchAll(pattern)) {
      const index = match.index ?? 0
      const before = haystack.slice(Math.max(0, index - 16), index)
      let score = 0
      if (/\b(?:19|20)\d{2}\b/.test(before)) score += 4
      if (/\b(?:19|20)\d{2}\b/.test(haystack.slice(index, index + 40))) score += 2
      if (/\b(VEHICLE|STOCK|VIN|DESCRIPTION)\b/.test(haystack)) score += 1
      if (/\bAPPLEWOOD\b/.test(before)) score -= 6
      if (/\bSURREY\b/.test(haystack.slice(index, index + 20))) score -= 4
      candidates.push({ make, index, matchLength: token.length, score })
    }
  }

  for (const match of haystack.matchAll(/\b[A-Z0-9]{4,}\b/g)) {
    if (isBoilerplate(match[0])) continue
    const make = normalizeMake(match[0])
    if (!make) continue
    const index = match.index ?? 0
    const before = haystack.slice(Math.max(0, index - 16), index)
    let score = 0
    if (/\b(?:19|20)\d{2}\b/.test(before)) score += 4
    if (/\b(VEHICLE|STOCK|VIN|DESCRIPTION)\b/.test(haystack)) score += 1
    if (/\bAPPLEWOOD\b/.test(before)) score -= 6
    candidates.push({ make, index, matchLength: match[0].length, score })
  }

  candidates.sort((a, b) => b.score - a.score || b.matchLength - a.matchLength)
  const best = candidates[0]
  if (!best || best.score < 0) return null
  return { make: best.make, index: best.index, matchLength: best.matchLength }
}

/**
 * Vehicle data only comes from an explicit description line or from text
 * anchored on a known make. Loose year/word matching picked up unrelated values
 * such as a date of birth on application forms.
 */
function extractVehicle(text: string): {
  year: ExtractedField
  make: ExtractedField
  model: ExtractedField
} {
  const descriptionLine = extractVehicleDescriptionLine(text)
  if (descriptionLine) {
    const parsed = parseYearMakeModel(descriptionLine) ?? parseMakeFirstDescription(descriptionLine)
    if (parsed) return parsed
  }

  const yearMakeModelLine = extractYearMakeModelLine(text)
  if (yearMakeModelLine) return yearMakeModelLine

  const describedRaw = extractAfterLabel(
    text,
    /Vehicle\s+Descriptions?\s*[:\s]*([A-Za-z0-9][A-Za-z0-9\s-]{2,40})/i
  )
  // The capture can run past the description into the next field, so stop at
  // VIN/stock keywords.
  const described = describedRaw?.split(/\b(?:VIN|STOCK)\b/i)[0]?.trim() || null
  if (described) {
    const parsed = parseYearMakeModel(described) ?? parseMakeFirstDescription(described)
    if (parsed) return parsed
  }

  const haystack = compactText(text).toUpperCase().replace(/[^A-Z0-9]+/g, ' ')
  const found = findKnownMake(haystack, text)
  if (!found) return emptyVehicle()

  const { make, index, matchLength } = found
  const before = haystack.slice(Math.max(0, index - 20), index)
  const yearBefore = before.match(/((?:19|20)\d{2})\s*$/)
  const hasVehicleContext = /\b(VEHICLE|STOCK|VIN|DESCRIPTION)\b/.test(haystack)

  if (!yearBefore && !hasVehicleContext) return emptyVehicle()

  const after = haystack.slice(index + matchLength).trim()
  const modelRaw = after.match(/^([A-Z0-9][A-Z0-9-]*(?:\s+[A-Z0-9-]+)?)/)?.[1] ?? null
  // Checklist layouts can also print the year after the model.
  const yearAfter = after.slice(0, 40).match(/\b((?:19|20)\d{2})\b/)
  const year = yearBefore?.[1] ?? yearAfter?.[1] ?? null

  return {
    year: field(year, 'high'),
    make: field(make, 'high'),
    model: buildModelField(make, modelRaw),
  }
}

/**
 * OCR runs several image variants and the merged text repeats each label once
 * per variant, some garbled. All occurrences are collected and voted on so one
 * bad variant cannot shadow a good read.
 */
function pickNameFromLabel(text: string, labelPattern: RegExp): string | null {
  const compact = compactText(text)
  const globalPattern = new RegExp(labelPattern.source, 'gi')
  const candidates: string[] = []

  for (const match of compact.matchAll(globalPattern)) {
    const captured = match[1]?.trim()
    if (captured && !isBoilerplate(captured)) {
      candidates.push(captured)
      continue
    }

    // Label cell bled into the value cell; take the next usable word instead.
    const tail = compact.slice((match.index ?? 0) + match[0].length)
    const nextWord = tail.match(/([A-Za-z][A-Za-z'-]{1,})/)?.[1]
    if (nextWord && !isBoilerplate(nextWord)) candidates.push(nextWord)
  }

  if (candidates.length === 0) return null

  // Each variant garbles the same cell differently ("sKvLA", "skyea", "SKYLA"
  // are all reads of SKYLA, while "sees" is an unrelated misread). The reads
  // of the true value form a cluster of near-identical strings, so the
  // candidate with the most close neighbours wins; among cluster members the
  // clean all-caps read is preferred, matching how these forms store values.
  const scored = candidates.map((candidate, index) => {
    const upper = candidate.toUpperCase()
    const neighbours = candidates.filter(
      (other, otherIndex) => otherIndex !== index && levenshtein(upper, other.toUpperCase()) <= 2
    ).length
    const allCaps = candidate === candidate.toUpperCase() ? 1 : 0
    return { candidate, index, score: neighbours * 2 + allCaps }
  })
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return scored[0].candidate
}

/**
 * On checklist forms the customer cell and phone cell share a row, so a line
 * reading "PANOPIO 778-522-0913" pins the last name far more reliably than
 * label scanning, which can drift into the neighbouring team-leader column.
 */
function findNameOnPhoneLine(text: string): string | null {
  const phonePattern = new RegExp(PHONE_REGEX.source)
  for (const line of lines(text)) {
    if (!phonePattern.test(line)) continue
    const withoutPhone = line.replace(new RegExp(PHONE_REGEX.source, 'g'), ' ')
    const words = withoutPhone
      .split(/\s+/)
      .map((word) => word.replace(/[^A-Za-z'-]/g, ''))
      .filter((word) => word.length >= 2)
    const substantial = words.filter((word) => !isBoilerplate(word))
    if (substantial.length === 1 && /^[A-Z][A-Z'-]{3,}$/.test(substantial[0])) {
      return substantial[0]
    }
  }
  return null
}

function extractLastName(text: string, allowLineScan: boolean): ExtractedField {
  if (allowLineScan) {
    const paired = findNameOnPhoneLine(text)
    if (paired) return field(paired.toUpperCase(), 'high')
  }

  const labeled =
    pickNameFromLabel(text, /Customer\s+Last\s+Name(?:\s+Only)?\s*[:\s]*([A-Za-z'-]{2,})?/i) ??
    pickNameFromLabel(text, /Last\s+Name\s*[:.\s*]*([A-Za-z'-]{2,})?/i)

  if (labeled) return field(labeled.toUpperCase(), 'high')

  if (allowLineScan) {
    for (const line of lines(text)) {
      const token = line.replace(/[^A-Za-z]/g, '')
      if (/^[A-Z]{4,}$/.test(token) && !isBoilerplate(token)) {
        return field(token, 'low')
      }
    }
  }

  return field(null, 'missing')
}

function extractFirstName(text: string): ExtractedField {
  const labeled = pickNameFromLabel(text, /First\s+Name\s*[:.\s*]*([A-Za-z'-]{2,})?/i)
  if (labeled) return field(labeled.toUpperCase(), 'high')
  return field(null, 'missing')
}

function parseSalesChecklist(text: string): DemandExtractResult {
  const result = createEmptyExtractResult()
  result.documentType = 'sales_checklist'

  result.lastName = extractLastName(text, true)
  result.phone = extractPhone(text)
  result.stockNumber = extractStockNumber(text, true)
  result.vinLast6 = extractVinLast6(text)

  const vehicle = extractVehicle(text)
  result.vehicleYear = vehicle.year
  result.vehicleMake = vehicle.make
  result.vehicleModel = vehicle.model

  return result
}

/**
 * Credit applications carry customer identity only. Vehicle, stock and VIN
 * fields are deliberately left empty so unrelated numbers (date of birth,
 * street number) never reach the demand form.
 */
function parseCreditApplication(text: string): DemandExtractResult {
  const result = createEmptyExtractResult()
  result.documentType = 'credit_application'

  result.firstName = extractFirstName(text)
  result.lastName = extractLastName(text, false)
  result.phone = extractPhone(text)

  return result
}

function parseGenericFallback(text: string): DemandExtractResult {
  const result = createEmptyExtractResult()
  result.documentType = 'unknown'

  result.firstName = extractFirstName(text)
  result.lastName = extractLastName(text, true)
  result.phone = extractPhone(text)
  result.stockNumber = extractStockNumber(text, false)
  result.vinLast6 = extractVinLast6(text)

  const vehicle = extractVehicle(text)
  result.vehicleYear = vehicle.year
  result.vehicleMake = vehicle.make
  result.vehicleModel = vehicle.model

  return result
}

/** Parse OCR text from a photo/PDF into demand form fields. */
export function parseDemandDocument(rawText: string): DemandExtractResult {
  const text = normalizeOcrText(rawText)
  if (!text) return createEmptyExtractResult()

  const documentType = detectDocumentType(text)
  if (documentType === 'sales_checklist') return parseSalesChecklist(text)
  if (documentType === 'credit_application') return parseCreditApplication(text)
  return parseGenericFallback(text)
}

import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const CODE_CHARS = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function randomSegment(length: number): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[bytes[i]! % CODE_CHARS.length]
  }
  return out
}

export function formatBarcodeCode(prefix: string): string {
  const p = prefix.trim().toUpperCase() || 'AUR'
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${p}-${datePart}-${randomSegment(6)}`
}

export async function generateUniqueBarcodeCode(
  supabase: SupabaseClient,
  prefix: string,
  maxAttempts = 12
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = formatBarcodeCode(prefix)
    const { data } = await supabase
      .from('inventory_barcodes')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (!data) return code
  }
  throw new Error('Could not generate a unique barcode code')
}

export function normalizeBarcodeCode(input: string): string {
  return input.trim().toUpperCase()
}

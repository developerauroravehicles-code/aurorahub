import { describe, it, expect } from 'vitest'
import { formatBarcodeCode, normalizeBarcodeCode } from '@/lib/inventory-barcodes/code-generator'

describe('barcode code generator', () => {
  it('generates codes with prefix and date segment', () => {
    const code = formatBarcodeCode('AUR')
    expect(code).toMatch(/^AUR-\d{8}-[0-9A-Z]{6}$/)
  })

  it('normalizes scanned input', () => {
    expect(normalizeBarcodeCode('  aur-20260827-abc123  ')).toBe('AUR-20260827-ABC123')
  })

  it('generates unique codes in batch', () => {
    const codes = new Set(Array.from({ length: 50 }, () => formatBarcodeCode('TST')))
    expect(codes.size).toBe(50)
  })
})

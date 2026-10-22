import { describe, expect, it } from 'vitest'
import * as generateModule from '@/lib/inventory-barcodes/generate'

describe('inventory barcode set policy', () => {
  it('does not export set container generation', () => {
    expect('generateSetBarcodes' in generateModule).toBe(false)
    expect(typeof generateModule.generateUnitBarcodesForSetTemplate).toBe('function')
  })
})

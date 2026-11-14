import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))
vi.mock('@/lib/demand-logger', () => ({ logDemandChange: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/webhook-dispatch', () => ({ dispatchWebhooks: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/issue-portal-token-for-phone', () => ({ issuePortalTokenForPhone: vi.fn(() => Promise.resolve(null)) }))
vi.mock('@/lib/daily-dealer-invoices', () => ({ addDemandToDailyBatch: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/scheduling-pool', () => ({ isSpecialistDoubleBooked: vi.fn(() => Promise.resolve(false)) }))
vi.mock('@/lib/demand-pricing', () => ({
  isDemandServiceType: (v: string) => ['installation', 'transfer', 'removal'].includes(v),
  isBarcodeRequiredForServiceType: (v: string) => v !== 'transfer',
  calculateDemandInvoiceAmount: vi.fn(() => Promise.resolve({ amount: 150 })),
  resolveCameraModelIdForDemand: vi.fn(() => Promise.resolve('cam-1')),
}))
vi.mock('@/lib/inventory-barcodes', () => ({
  isBarcodeModeEnabled: vi.fn(() => Promise.resolve(true)),
  validateSpecialistBarcode: vi.fn(() => Promise.resolve({ valid: true })),
  consumeBarcodesForDemand: vi.fn(() => Promise.resolve({ cameraModelIds: ['cam-2'] })),
}))

import { completeDemandCore } from '../complete-demand'
import { consumeBarcodesForDemand } from '@/lib/inventory-barcodes'

type Demand = Record<string, unknown>

function fakeSupabase(demand: Demand | null) {
  const updates: Record<string, unknown>[] = []
  const client = {
    updates,
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        single: () => Promise.resolve({ data: demand }),
        update: (payload: Record<string, unknown>) => {
          updates.push(payload)
          return { eq: () => Promise.resolve({ error: null }) }
        },
      }
      return q
    },
    rpc: () => Promise.resolve({ data: [{ camera_model_id: 'cam-2' }] }),
  }
  return client
}

const baseDemand = {
  assigned_specialist_id: 'spec-1',
  status: 'approved',
  vin_last6: 'ABC123',
  dealer_id: 'dealer-1',
  camera_model_id: null,
  camera_model: 'Cam',
  customer_phone: null,
  appointment_date: '2026-11-06T15:00:00Z',
}

describe('completeDemandCore', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires a valid service type', async () => {
    const sb = fakeSupabase(baseDemand)
    const r = await completeDemandCore(sb as never, 'spec-1', 'd1', { serviceType: 'repair' as never })
    expect(r).toEqual({ error: 'Service type is required.' })
  })

  it('rejects a VIN mismatch without updating anything', async () => {
    const sb = fakeSupabase(baseDemand)
    const r = await completeDemandCore(sb as never, 'spec-1', 'd1', {
      serviceType: 'installation',
      vinLast6: 'zzz999',
      barcodeCodes: ['AUR-1'],
    })
    expect(r).toHaveProperty('error')
    expect(sb.updates).toHaveLength(0)
  })

  it('rejects work assigned to someone else', async () => {
    const sb = fakeSupabase({ ...baseDemand, assigned_specialist_id: 'other' })
    const r = await completeDemandCore(sb as never, 'spec-1', 'd1', {
      serviceType: 'installation',
      vinLast6: 'abc123',
      barcodeCodes: ['AUR-1'],
    })
    expect(r).toEqual({ error: 'You can only complete work assigned to you' })
  })

  it('requires a barcode for installation in barcode mode', async () => {
    const sb = fakeSupabase(baseDemand)
    const r = await completeDemandCore(sb as never, 'spec-1', 'd1', {
      serviceType: 'installation',
      vinLast6: 'abc123',
    })
    expect(r).toEqual({ error: 'Scan at least one product barcode to complete this job.' })
    expect(consumeBarcodesForDemand).not.toHaveBeenCalled()
  })

  it('consumes barcodes and marks the demand completed', async () => {
    const sb = fakeSupabase(baseDemand)
    const r = await completeDemandCore(sb as never, 'spec-1', 'd1', {
      serviceType: 'installation',
      vinLast6: 'xyabc123',
      delayFeeTier: '30min',
      barcodeCodes: ['AUR-1', ' AUR-2 '],
    })
    expect(r).toEqual({ success: true })
    expect(consumeBarcodesForDemand).toHaveBeenCalledWith(
      sb,
      expect.anything(),
      expect.objectContaining({ codes: ['AUR-1', 'AUR-2'], demandId: 'd1', specialistId: 'spec-1' })
    )
    expect(sb.updates.at(-1)).toMatchObject({
      status: 'completed',
      service_type: 'installation',
      delay_fee_tier: '30min',
      invoice_total_amount: 150,
      camera_model_id: 'cam-2',
    })
  })
})

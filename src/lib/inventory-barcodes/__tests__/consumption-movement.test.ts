import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordConsumptionMovement } from '@/lib/inventory-barcodes/consumption-movement'

type MovementRow = { id: string; quantity: number }

function mockSupabaseForConsumption(options: {
  existing: MovementRow | null
  insertError?: string
  updateError?: string
}) {
  const insert = vi.fn().mockResolvedValue({ error: options.insertError ? { message: options.insertError } : null })
  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({
      error: options.updateError ? { message: options.updateError } : null,
    }),
  })

  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: options.existing }),
  }

  const from = vi.fn((table: string) => {
    if (table !== 'inventory_movements_v2') throw new Error(`unexpected table ${table}`)
    return {
      select: chain.select,
      eq: chain.eq,
      maybeSingle: chain.maybeSingle,
      insert,
      update,
    }
  })

  return {
    supabase: { from } as unknown as SupabaseClient,
    insert,
    update,
  }
}

describe('recordConsumptionMovement', () => {
  const baseInput = {
    cameraModelId: 'model-a',
    fromLocationId: 'loc-1',
    demandId: 'demand-1',
    note: 'test',
  }

  it('inserts a new consumption row when none exists for demand+location+model', async () => {
    const { supabase, insert } = mockSupabaseForConsumption({ existing: null })
    const result = await recordConsumptionMovement(supabase, baseInput)
    expect(result.error).toBeUndefined()
    expect(insert).toHaveBeenCalledWith({
      camera_model_id: 'model-a',
      movement_type: 'consumption',
      quantity: 1,
      from_location_id: 'loc-1',
      reference_demand_id: 'demand-1',
      note: 'test',
    })
  })

  it('increments quantity when a row already exists (same model, second barcode)', async () => {
    const { supabase, insert, update } = mockSupabaseForConsumption({
      existing: { id: 'mov-1', quantity: 1 },
    })
    const result = await recordConsumptionMovement(supabase, baseInput)
    expect(result.error).toBeUndefined()
    expect(insert).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({ quantity: 2, note: 'test' })
  })

  it('allows a second model on the same demand and location via separate insert', async () => {
    const { supabase, insert } = mockSupabaseForConsumption({ existing: null })
    const result = await recordConsumptionMovement(supabase, {
      ...baseInput,
      cameraModelId: 'model-b',
    })
    expect(result.error).toBeUndefined()
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ camera_model_id: 'model-b' })
    )
  })
})

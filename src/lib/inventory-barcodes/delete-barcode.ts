import type { SupabaseClient } from '@supabase/supabase-js'

/** Remove mistaken generated/void rows only — not consumed or field stock. */
export async function deleteBarcodeRecord(
  supabase: SupabaseClient,
  barcodeId: string,
  actorId: string | null
): Promise<{ error?: string }> {
  const { data: barcode } = await supabase
    .from('inventory_barcodes')
    .select('id, code, kind, status, parent_barcode_id')
    .eq('id', barcodeId)
    .maybeSingle()

  if (!barcode) return { error: 'Barcode not found' }
  if (barcode.status === 'consumed') {
    return { error: 'Consumed barcodes cannot be deleted. Use Customer demand barcode change instead.' }
  }
  if (barcode.status === 'at_dealer' || barcode.status === 'at_specialist') {
    return { error: 'Void this barcode first, then delete if it was created by mistake.' }
  }
  if (barcode.status !== 'generated' && barcode.status !== 'void') {
    return { error: `Cannot delete barcode in status ${barcode.status}` }
  }

  if (barcode.kind === 'set') {
    const { count } = await supabase
      .from('inventory_barcodes')
      .select('id', { count: 'exact', head: true })
      .eq('parent_barcode_id', barcodeId)
      .neq('status', 'void')

    if ((count ?? 0) > 0) {
      return { error: 'Delete or void all unit barcodes in this set first' }
    }
  }

  await supabase.from('inventory_barcode_events').insert({
    barcode_id: barcodeId,
    event_type: 'deleted',
    actor_id: actorId,
    metadata: { code: barcode.code, status: barcode.status },
  })

  const { error } = await supabase.from('inventory_barcodes').delete().eq('id', barcodeId)
  if (error) return { error: error.message }
  return {}
}

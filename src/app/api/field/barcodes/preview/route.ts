import { NextResponse } from 'next/server'
import { fieldError, readJson, requireFieldSpecialist } from '@/lib/field/auth'
import { barcodePreviewSchema } from '@/lib/field/schemas'
import { validateSpecialistBarcode } from '@/lib/inventory-barcodes'

/** POST /api/field/barcodes/preview { code } — checks the unit is assigned to this specialist. */
export async function POST(request: Request) {
  const ctx = await requireFieldSpecialist(request)
  if (ctx instanceof NextResponse) return ctx

  const parsed = barcodePreviewSchema.safeParse(await readJson(request))
  if (!parsed.success) return fieldError('Enter a barcode', 400)

  const code = parsed.data.code
  const result = await validateSpecialistBarcode(ctx.supabase, code)
  if (!result.valid) return fieldError(result.error ?? 'Invalid barcode', 422)

  return NextResponse.json({
    code: code.toUpperCase(),
    modelName: result.cameraModelName ?? 'Unit',
  })
}

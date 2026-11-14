import { z } from 'zod'

const latitude = z.number().min(-90).max(90)
const longitude = z.number().min(-180).max(180)

const latLng = z.object({ lat: latitude, lng: longitude })

/** Device location reading plus the geocoded job address (null if geocoding failed). */
export const locationProofSchema = z.object({
  location: latLng.extend({ accuracyM: z.number().min(0).max(100_000).nullable().optional() }),
  addressLocation: latLng.nullable().optional(),
  reason: z.string().trim().max(1000).optional(),
})

export const startJobSchema = locationProofSchema

export const completeJobSchema = locationProofSchema.extend({
  serviceType: z.enum(['installation', 'transfer', 'removal']),
  vinLast6: z.string().trim().max(17).optional(),
  delayFeeTier: z.enum(['none', '30min', '60min']).optional(),
  barcodeCodes: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  photoPaths: z.array(z.string().min(1).max(512)).max(10).optional(),
})

export const barcodePreviewSchema = z.object({
  code: z.string().trim().min(1).max(64),
})

export type StartJobInput = z.infer<typeof startJobSchema>
export type CompleteJobInput = z.infer<typeof completeJobSchema>

/** Storage paths must live under `<specialistId>/<demandId>/` in the field-photos bucket. */
export function isOwnPhotoPath(path: string, specialistId: string, demandId: string): boolean {
  const prefix = `${specialistId}/${demandId}/`
  return path.startsWith(prefix) && path.length > prefix.length && !path.includes('..')
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const leaveRequestSchema = z.object({
  leaveType: z.string().min(1).max(32),
  startDate: isoDate,
  endDate: isoDate,
  notes: z.string().max(1000).optional(),
})

export const itRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional(),
  category: z.string().min(1).max(32),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
})

export const extraDutyPreviewSchema = z.object({
  hours: z.string().max(4),
  minutes: z.string().max(4),
})

export const scrollProgressSchema = z.object({
  percent: z.number().min(0).max(100),
})

/**
 * Client-safe SMS template preview - uses sample placeholder values.
 * For actual sending, sms-resolver is used server-side.
 */
export function previewSmsTemplate(
  trigger: 'appointment_created' | 'cancellation_notice' | 'rescheduling_notice' | 'four_hour_reminder' | 'twenty_four_hour_reminder',
  template: string,
  opts: { signature: string; contactPhone: string; hoursBefore?: number }
): string {
  const sampleDate = 'February 15, 2026 at 2:30 PM'
  const sampleAddress = '123 Main St, Vancouver'
  const sampleHours = opts.hoursBefore === 24 ? '24 hours' : opts.hoursBefore === 2 ? '2 hours' : opts.hoursBefore === 6 ? '6 hours' : '4 hours'

  let result = template
    .replace(/\{\{date\}\}/g, sampleDate)
    .replace(/\{\{address\}\}/g, sampleAddress)
    .replace(/\{\{hours\}\}/g, sampleHours)
    .replace(/\{\{phone\}\}/g, opts.contactPhone)
    .replace(/\{\{signature\}\}/g, opts.signature)
  return result
}

/** SMS character count - messages over 160 chars may be split into multiple segments */
export function getSmsSegmentCount(text: string): number {
  if (!text.trim()) return 0
  // GSM-7: 160 chars per segment, 153 if concatenated. For simplicity use 160.
  const len = text.length
  if (len <= 160) return 1
  return Math.ceil(len / 153) // 153 for concatenated multi-part
}

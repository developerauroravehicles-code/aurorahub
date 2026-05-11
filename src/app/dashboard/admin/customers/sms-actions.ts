'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'
import { sendSMS } from '@/lib/twilio'
import { logSmsSent } from '@/lib/sms-logger'
import { getSmsSettings } from '@/lib/sms-resolver'

const MAX_BODY_LENGTH = 1600
/** Hard cap to avoid accidental huge payloads; well above typical bulk campaigns. */
const MAX_RECIPIENTS_SAFETY = 10_000
const MIN_PHONE_DIGITS = 7
/** Parallel sends per batch (Twilio-friendly; reduces wall time for large selections). */
const SEND_CONCURRENCY = 10

export type CustomerDirectorySmsRecipientInput = {
  phone: string
  displayName?: string
}

function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '')
}

function dedupeRecipients(list: CustomerDirectorySmsRecipientInput[]): CustomerDirectorySmsRecipientInput[] {
  const seen = new Set<string>()
  const out: CustomerDirectorySmsRecipientInput[] = []
  for (const r of list) {
    const key = phoneKey(r.phone)
    if (key.length < MIN_PHONE_DIGITS) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

export async function sendCustomerDirectorySms(params: {
  recipients: CustomerDirectorySmsRecipientInput[]
  body: string
  appendSignature?: boolean
}): Promise<{
  success: boolean
  error?: string
  sentCount?: number
  failed?: { phone: string; error: string }[]
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const perm = await requirePermission('comm.sms.send')
  if (perm !== true) return { success: false, error: perm.error }

  const rawBody = typeof params.body === 'string' ? params.body.trim() : ''
  if (rawBody.length < 1) {
    return { success: false, error: 'Message body is required.' }
  }

  const smsSettings = await getSmsSettings(supabase)
  const signature =
    typeof smsSettings.signature === 'string' && smsSettings.signature.trim()
      ? smsSettings.signature.trim()
      : ''

  let bodyPart = rawBody
  if (params.appendSignature && signature) {
    bodyPart = `${rawBody}\n\n${signature}`
  }

  if (bodyPart.length > MAX_BODY_LENGTH) {
    return {
      success: false,
      error: `Message is too long (max ${MAX_BODY_LENGTH} characters including signature).`,
    }
  }

  const recipients = dedupeRecipients(Array.isArray(params.recipients) ? params.recipients : [])
  if (recipients.length === 0) {
    return { success: false, error: 'No valid phone numbers to send to.' }
  }
  if (recipients.length > MAX_RECIPIENTS_SAFETY) {
    return {
      success: false,
      error: `Too many recipients (max ${MAX_RECIPIENTS_SAFETY} per request).`,
    }
  }

  const failed: { phone: string; error: string }[] = []
  let sentCount = 0

  for (let i = 0; i < recipients.length; i += SEND_CONCURRENCY) {
    const batch = recipients.slice(i, i + SEND_CONCURRENCY)
    const batchOut = await Promise.all(
      batch.map(async (r) => {
        const result = await sendSMS(r.phone, bodyPart)
        return { r, result }
      })
    )
    for (const { r, result } of batchOut) {
      if (result.success) {
        sentCount += 1
        const recipientName = r.displayName?.trim() || undefined
        logSmsSent({
          phoneNumber: r.phone,
          recipientType: 'customer',
          recipientName,
          messageType: 'customer_directory_manual',
          triggeredBy: 'manual',
          messageContent: bodyPart,
        }).catch(() => {})
      } else {
        const e = (result as { error?: unknown }).error
        let err = 'Send failed'
        if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
          err = (e as { message: string }).message
        } else if (e != null) {
          err = String(e)
        }
        failed.push({ phone: r.phone, error: err })
      }
    }
  }

  if (sentCount === 0) {
    return {
      success: false,
      error: failed[0]?.error ?? 'All sends failed.',
      sentCount: 0,
      failed,
    }
  }

  return {
    success: true,
    sentCount,
    failed: failed.length ? failed : undefined,
  }
}

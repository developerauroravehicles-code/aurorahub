import { NextResponse } from 'next/server'
import { formatInTimeZone } from 'date-fns-tz'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/twilio'
import { getSmsSettings, resolveLifecycleTemplate } from '@/lib/sms-resolver'
import { logSmsAttempt, type SmsMessageType } from '@/lib/sms-logger'
import { issuePortalTokenForPhone } from '@/lib/issue-portal-token-for-phone'
import { isFutureCustomer } from '@/lib/future-customer'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { SYSTEM_DEFAULT_TIMEZONE } from '@/lib/timezone-defaults'
import { notifyAuroraManagersSmsFailed } from '@/lib/notify-sms-failed'

const DEMAND_SELECT = `
  id,
  customer_phone,
  customer_firstname,
  customer_lastname,
  vehicle_year,
  vehicle_make,
  vehicle_model,
  completed_at,
  updated_at,
  post_completion_portal_sms_sent_at,
  post_completion_custom_sms_sent_at,
  sd_card_warranty_sms_sent_at,
  dashcam_warranty_sms_sent_at,
  dealers(name, address, warranty_years, region_codes(timezone_id, timezones(name)))
`

type LifecycleDemand = {
  id: string
  customer_phone?: string | null
  customer_firstname?: string | null
  customer_lastname?: string | null
  vehicle_year?: number | null
  vehicle_make?: string | null
  vehicle_model?: string | null
  completed_at?: string | null
  updated_at?: string | null
  post_completion_portal_sms_sent_at?: string | null
  post_completion_custom_sms_sent_at?: string | null
  sd_card_warranty_sms_sent_at?: string | null
  dashcam_warranty_sms_sent_at?: string | null
  dealers?: {
    name?: string | null
    warranty_years?: number | null
    region_codes?: { timezones?: { name: string } } | null
  } | null
}

function completionDate(demand: LifecycleDemand): Date | null {
  const raw = demand.completed_at ?? demand.updated_at
  if (!raw) return null
  const d = new Date(raw)
  return Number.isFinite(d.getTime()) ? d : null
}

function todayInTimezone(tz: string): string {
  return formatInTimeZone(new Date(), tz, 'yyyy-MM-dd')
}

function dateInTimezone(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, 'yyyy-MM-dd')
}

function addDays(dateIso: string, days: number, tz: string): string {
  const base = new Date(`${dateIso}T12:00:00`)
  base.setUTCDate(base.getUTCDate() + days)
  return formatInTimeZone(base, tz, 'yyyy-MM-dd')
}

function addMonths(dateIso: string, months: number, tz: string): string {
  const base = new Date(`${dateIso}T12:00:00`)
  base.setUTCMonth(base.getUTCMonth() + months)
  return formatInTimeZone(base, tz, 'yyyy-MM-dd')
}

function addYears(dateIso: string, years: number, tz: string): string {
  const base = new Date(`${dateIso}T12:00:00`)
  base.setUTCFullYear(base.getUTCFullYear() + years)
  return formatInTimeZone(base, tz, 'yyyy-MM-dd')
}

function timezoneForDemand(demand: LifecycleDemand): string {
  return getTimezoneFromDealer(demand.dealers as Parameters<typeof getTimezoneFromDealer>[0]) ?? SYSTEM_DEFAULT_TIMEZONE
}

function isEligibleCustomer(demand: LifecycleDemand): boolean {
  if (!demand.customer_phone?.trim()) return false
  if (isFutureCustomer(demand)) return false
  return true
}

async function sendLifecycleSms(
  supabase: ReturnType<typeof createAdminClient>,
  demand: LifecycleDemand,
  messageType: SmsMessageType,
  message: string,
  dedupColumn:
    | 'post_completion_portal_sms_sent_at'
    | 'post_completion_custom_sms_sent_at'
    | 'sd_card_warranty_sms_sent_at'
    | 'dashcam_warranty_sms_sent_at'
): Promise<'sent' | 'failed' | 'skipped'> {
  const phone = demand.customer_phone!
  const result = await sendSMS(phone, message)

  if (result.success) {
    await supabase
      .from('demands')
      .update({ [dedupColumn]: new Date().toISOString() })
      .eq('id', demand.id)
      .is(dedupColumn, null)

    await logSmsAttempt(
      {
        phoneNumber: phone,
        recipientType: 'customer',
        recipientName: `${demand.customer_firstname ?? ''} ${demand.customer_lastname ?? ''}`.trim() || undefined,
        demandId: demand.id,
        messageType,
        triggeredBy: 'system',
        messageContent: message,
        twilioSid: 'sid' in result ? result.sid : undefined,
      },
      supabase
    )
    return 'sent'
  }

  await logSmsAttempt(
    {
      phoneNumber: phone,
      recipientType: 'customer',
      recipientName: `${demand.customer_firstname ?? ''} ${demand.customer_lastname ?? ''}`.trim() || undefined,
      demandId: demand.id,
      messageType,
      triggeredBy: 'system',
      messageContent: message,
      deliveryStatus: 'failed',
      errorMessage: result.errorMessage,
    },
    supabase
  )
  notifyAuroraManagersSmsFailed(supabase, demand.id, messageType, result.errorMessage).catch(() => {})
  return 'failed'
}

/**
 * Daily lifecycle SMS: post-completion (portal + custom), SD card warranty, dashcam warranty.
 */
export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const url = new URL(request.url)
  const querySecret = url.searchParams.get('secret')
  const isAuthorized =
    expectedSecret &&
    (authHeader === `Bearer ${expectedSecret}` || querySecret === expectedSecret)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const smsSettings = await getSmsSettings(supabase)

    const { data: demands, error } = await supabase
      .from('demands')
      .select(DEMAND_SELECT)
      .eq('status', 'completed')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let sent = 0
    let failed = 0
    let skipped = 0

    for (const raw of demands ?? []) {
      const demand = raw as LifecycleDemand
      const completed = completionDate(demand)
      if (!completed || !isEligibleCustomer(demand)) {
        skipped++
        continue
      }

      const tz = timezoneForDemand(demand)
      const completedDay = dateInTimezone(completed.toISOString(), tz)
      const today = todayInTimezone(tz)
      const nextDay = addDays(completedDay, 1, tz)
      const sdCardDay = addMonths(completedDay, 6, tz)
      const warrantyYears = demand.dealers?.warranty_years ?? 3
      const dashcamWarrantyDay = addYears(completedDay, warrantyYears, tz)

      // Post-completion portal SMS (day after complete)
      if (
        smsSettings.post_completion_portal.enabled &&
        smsSettings.post_completion_portal.sendToCustomer &&
        !demand.post_completion_portal_sms_sent_at &&
        today >= nextDay
      ) {
        const portal = await issuePortalTokenForPhone(demand.customer_phone!)
        const message = resolveLifecycleTemplate(smsSettings.post_completion_portal.template, {
          signature: smsSettings.signature,
          portalLink: portal?.url ?? '',
          demand,
        })
        const outcome = await sendLifecycleSms(
          supabase,
          demand,
          'post_completion_portal',
          message,
          'post_completion_portal_sms_sent_at'
        )
        if (outcome === 'sent') sent++
        else if (outcome === 'failed') failed++
        else skipped++
      }

      // Post-completion custom SMS (day after complete)
      if (
        smsSettings.post_completion_custom.enabled &&
        smsSettings.post_completion_custom.sendToCustomer &&
        !demand.post_completion_custom_sms_sent_at &&
        today >= nextDay
      ) {
        const portal = await issuePortalTokenForPhone(demand.customer_phone!)
        const message = resolveLifecycleTemplate(smsSettings.post_completion_custom.template, {
          signature: smsSettings.signature,
          portalLink: portal?.url ?? '',
          demand,
        })
        const outcome = await sendLifecycleSms(
          supabase,
          demand,
          'post_completion_custom',
          message,
          'post_completion_custom_sms_sent_at'
        )
        if (outcome === 'sent') sent++
        else if (outcome === 'failed') failed++
        else skipped++
      }

      // SD card warranty (6 months after complete)
      if (
        smsSettings.sd_card_warranty_expired.enabled &&
        smsSettings.sd_card_warranty_expired.sendToCustomer &&
        !demand.sd_card_warranty_sms_sent_at &&
        today === sdCardDay
      ) {
        const message = resolveLifecycleTemplate(smsSettings.sd_card_warranty_expired.template, {
          signature: smsSettings.signature,
          demand,
        })
        const outcome = await sendLifecycleSms(
          supabase,
          demand,
          'sd_card_warranty_expired',
          message,
          'sd_card_warranty_sms_sent_at'
        )
        if (outcome === 'sent') sent++
        else if (outcome === 'failed') failed++
        else skipped++
      }

      // Dashcam warranty expiry
      if (
        smsSettings.dashcam_warranty_expired.enabled &&
        smsSettings.dashcam_warranty_expired.sendToCustomer &&
        !demand.dashcam_warranty_sms_sent_at &&
        today === dashcamWarrantyDay
      ) {
        const message = resolveLifecycleTemplate(smsSettings.dashcam_warranty_expired.template, {
          signature: smsSettings.signature,
          demand,
        })
        const outcome = await sendLifecycleSms(
          supabase,
          demand,
          'dashcam_warranty_expired',
          message,
          'dashcam_warranty_sms_sent_at'
        )
        if (outcome === 'sent') sent++
        else if (outcome === 'failed') failed++
        else skipped++
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      skipped,
      message: `Lifecycle SMS: ${sent} sent, ${failed} failed, ${skipped} skipped`,
    })
  } catch (err) {
    console.error('send-lifecycle-sms error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/twilio'
import { isWithinHoursBeforeWindow } from '@/lib/sms-messages'
import { getSmsSettings } from '@/lib/sms-resolver'
import { resolveReminderTemplate } from '@/lib/sms-resolver'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { logSmsSent } from '@/lib/sms-logger'
import { getReminderAutomationConfig, getReminder24hAutomationConfig } from '@/lib/automation-settings'
import { notifyAuroraManagersSmsFailed } from '@/lib/notify-sms-failed'

const DEMAND_SELECT = 'id, appointment_date, customer_phone, customer_firstname, customer_lastname, customer_address, status, dealer_id, assigned_specialist_id, reminder_sent_at, reminder_24h_sent_at, dealers(region_codes(timezone_id, timezones(name)))'

/**
 * API Route for sending reminder SMS
 * Called by cron every hour at the top of the hour.
 * Sends 24h reminder and 4h reminder (configurable 2/4/6h) before each appointment.
 * Requires CRON_SECRET in env; Vercel sends it as Authorization: Bearer <secret>.
 * Query param ?secret=<CRON_SECRET> also accepted for external cron services.
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
    return NextResponse.json(
      { error: 'Unauthorized. Set CRON_SECRET in Vercel env vars.' },
      { status: 401 }
    )
  }

  try {
    const supabase = createAdminClient()
    const reminderConfig = await getReminderAutomationConfig(supabase)
    const reminder24hConfig = await getReminder24hAutomationConfig(supabase)

    if (!reminderConfig.enabled && !reminder24hConfig.enabled) {
      return NextResponse.json({
        success: true,
        message: 'Reminder automation is disabled',
        sent: 0,
        errors: 0,
      })
    }

    const now = new Date()
    let sentCount = 0
    let errorCount = 0

    // --- 24-hour reminder pass ---
    // Window filter is isWithinHoursBeforeWindow(..., 24) → real time until appointment ∈ (23.5h, 24.5h].
    // DB prefilter must INCLUDE that interval: appointments roughly 22h–26h out (same idea as 4h pass using now..now+7h).
    // BUGFIX: Previously used [now+24h, now+31h], which EXCLUDED 23.5h–24h — those never matched and 24h SMS was skipped.
    if (reminder24hConfig.enabled && (reminder24hConfig.sendToCustomer || reminder24hConfig.sendToSpecialist)) {
      const lower24 = new Date(now.getTime() + 22 * 60 * 60 * 1000)
      const upper24 = new Date(now.getTime() + 26 * 60 * 60 * 1000)

      const { data: demands24h, error: err24h } = await supabase
        .from('demands')
        .select(DEMAND_SELECT)
        .eq('status', 'approved')
        .gte('appointment_date', lower24.toISOString())
        .lte('appointment_date', upper24.toISOString())
        .is('reminder_24h_sent_at', null)

      if (!err24h && demands24h?.length) {
        const smsSettings = await getSmsSettings(supabase)
        const rh24 = smsSettings.twenty_four_hour_reminder
        const address = (d: { customer_address?: string | null }) => d.customer_address || 'the specified location'

        for (const demand of demands24h) {
          const appointmentDate = new Date(demand.appointment_date)
          if (!isWithinHoursBeforeWindow(appointmentDate, 24)) continue

          const canCustomer =
            reminder24hConfig.sendToCustomer && !!(demand as { customer_phone?: string | null }).customer_phone
          let specialistForSend: { phone: string; full_name: string | null } | null = null
          if (reminder24hConfig.sendToSpecialist && (demand as { assigned_specialist_id?: string }).assigned_specialist_id) {
            try {
              const { data: specialist } = await supabase
                .from('profiles')
                .select('phone, full_name')
                .eq('id', (demand as { assigned_specialist_id?: string }).assigned_specialist_id!)
                .single()
              if (specialist?.phone) specialistForSend = { phone: specialist.phone, full_name: specialist.full_name }
            } catch {
              /* ignore */
            }
          }
          if (!canCustomer && !specialistForSend) continue

          // Atomic claim: only one cron instance can claim this demand
          const { data: claimed24h } = await supabase
            .from('demands')
            .update({ reminder_24h_sent_at: new Date().toISOString() })
            .eq('id', demand.id)
            .is('reminder_24h_sent_at', null)
            .select('id')
            .single()
          if (!claimed24h) continue // Another instance already claimed it

          const message = resolveReminderTemplate(rh24.template, {
            hoursText: '24 hours',
            address: address(demand),
            signature: smsSettings.signature,
          })

          if (canCustomer) {
            try {
              const result = await sendSMS((demand as { customer_phone: string }).customer_phone, message)
              if (result.success) {
                sentCount++
                logSmsSent(
                  {
                    phoneNumber: demand.customer_phone,
                    recipientType: 'customer',
                    recipientName: `${(demand as { customer_firstname?: string }).customer_firstname} ${(demand as { customer_lastname?: string }).customer_lastname}`.trim(),
                    demandId: demand.id,
                    messageType: 'twenty_four_hour_reminder',
                    triggeredBy: 'system',
                    messageContent: message,
                  },
                  supabase
                ).catch(() => {})
              } else {
                errorCount++
                notifyAuroraManagersSmsFailed(supabase, demand.id, 'twenty_four_hour_reminder', 'Send failed').catch(() => {})
              }
            } catch {
              errorCount++
              notifyAuroraManagersSmsFailed(supabase, demand.id, 'twenty_four_hour_reminder', 'Send error').catch(() => {})
            }
          }

          if (specialistForSend) {
            try {
              const result = await sendSMS(specialistForSend.phone, message)
              if (result.success) {
                sentCount++
                logSmsSent(
                  {
                    phoneNumber: specialistForSend.phone,
                    recipientType: 'specialist',
                    recipientName: specialistForSend.full_name ?? undefined,
                    demandId: demand.id,
                    messageType: 'twenty_four_hour_reminder',
                    triggeredBy: 'system',
                    messageContent: message,
                  },
                  supabase
                ).catch(() => {})
              } else errorCount++
            } catch {
              errorCount++
            }
          }

          // reminder_24h_sent_at already set by atomic claim above
        }
      }
    }

    // --- 4-hour reminder pass (existing) ---
    if (reminderConfig.enabled) {
      const sevenHoursFromNow = new Date(now.getTime() + 7 * 60 * 60 * 1000)

      const { data: demands, error } = await supabase
        .from('demands')
        .select(DEMAND_SELECT)
        .eq('status', 'approved')
        .gte('appointment_date', now.toISOString())
        .lte('appointment_date', sevenHoursFromNow.toISOString())
        .is('reminder_sent_at', null)
        .not('customer_phone', 'is', null)

      if (!error && demands?.length) {
        const smsSettings = await getSmsSettings(supabase)
        const rh = smsSettings.four_hour_reminder

        for (const demand of demands) {
          const appointmentDate = new Date(demand.appointment_date)
          if (!isWithinHoursBeforeWindow(appointmentDate, reminderConfig.hoursBefore)) continue
          if (!reminderConfig.sendToCustomer && !reminderConfig.sendToSpecialist) continue

          // Atomic claim: only one cron instance can claim this demand
          const { data: claimed4h } = await supabase
            .from('demands')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', demand.id)
            .is('reminder_sent_at', null)
            .select('id')
            .single()
          if (!claimed4h) continue // Another instance already claimed it

          const hoursText = reminderConfig.hoursBefore === 1 ? '1 hour' : `${reminderConfig.hoursBefore} hours`
          const address = demand.customer_address || 'the specified location'
          const message = resolveReminderTemplate(rh.template, {
            hoursText,
            address,
            signature: smsSettings.signature,
          })

          let sentForThisDemand = false

          if (reminderConfig.sendToCustomer && demand.customer_phone) {
            try {
              const result = await sendSMS(demand.customer_phone, message)
              if (result.success) {
                sentCount++
                sentForThisDemand = true
                logSmsSent({
                  phoneNumber: demand.customer_phone,
                  recipientType: 'customer',
                  recipientName: `${(demand as { customer_firstname?: string }).customer_firstname} ${(demand as { customer_lastname?: string }).customer_lastname}`.trim(),
                  demandId: demand.id,
                  messageType: 'four_hour_reminder',
                  triggeredBy: 'system',
                  messageContent: message,
                }, supabase).catch(() => {})
              } else {
                errorCount++
                notifyAuroraManagersSmsFailed(supabase, demand.id, 'four_hour_reminder', 'Send failed').catch(() => {})
              }
            } catch {
              errorCount++
              notifyAuroraManagersSmsFailed(supabase, demand.id, 'four_hour_reminder', 'Send error').catch(() => {})
            }
          }

          if (reminderConfig.sendToSpecialist && (demand as { assigned_specialist_id?: string }).assigned_specialist_id) {
            try {
              const { data: specialist } = await supabase
                .from('profiles')
                .select('phone, full_name')
                .eq('id', (demand as { assigned_specialist_id?: string }).assigned_specialist_id)
                .single()
              if (specialist?.phone) {
                const result = await sendSMS(specialist.phone, message)
                if (result.success) {
                  sentCount++
                  sentForThisDemand = true
                  logSmsSent({
                    phoneNumber: specialist.phone,
                    recipientType: 'specialist',
                    recipientName: specialist.full_name ?? undefined,
                    demandId: demand.id,
                    messageType: 'four_hour_reminder',
                    triggeredBy: 'system',
                    messageContent: message,
                  }, supabase).catch(() => {})
                } else errorCount++
              }
            } catch { errorCount++ }
          }

          // reminder_sent_at already set by atomic claim above
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reminders processed: ${sentCount} sent, ${errorCount} errors`,
      sent: sentCount,
      errors: errorCount,
    })
  } catch (error) {
    console.error('Error in send-reminders route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


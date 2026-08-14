import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/twilio'
import { isWithinHoursBeforeWindow } from '@/lib/sms-messages'
import { getSmsSettings } from '@/lib/sms-resolver'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import { logSmsAttempt } from '@/lib/sms-logger'
import { getReminderAutomationConfig, getReminder24hAutomationConfig } from '@/lib/automation-settings'
import { notifyAuroraManagersSmsFailed } from '@/lib/notify-sms-failed'
import { buildCustomerSmsMessage, buildSpecialistSmsMessage } from '@/lib/sms-message-builder'

const DEMAND_SELECT =
  'id, appointment_date, customer_phone, customer_firstname, customer_lastname, customer_address, status, dealer_id, assigned_specialist_id, reminder_sent_at, reminder_24h_sent_at, vehicle_year, vehicle_make, vehicle_model, vin_last6, stock_number, dealers(name, address, region_codes(timezone_id, timezones(name)))'

type DemandRow = {
  id: string
  appointment_date: string
  customer_phone?: string | null
  customer_firstname?: string | null
  customer_lastname?: string | null
  customer_address?: string | null
  assigned_specialist_id?: string | null
  vehicle_year?: number | null
  vehicle_make?: string | null
  vehicle_model?: string | null
  vin_last6?: string | null
  stock_number?: string | null
  dealers?: { name?: string; address?: string; region_codes?: { timezones?: { name: string } } } | null
}

function dealerContext(demand: DemandRow) {
  const timezoneName = getTimezoneFromDealer(demand.dealers as Parameters<typeof getTimezoneFromDealer>[0]) ?? undefined
  return {
    name: demand.dealers?.name,
    address: demand.dealers?.address,
    timezoneName,
  }
}

/**
 * API Route for sending reminder SMS
 * Called by cron every hour at the top of the hour.
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

        for (const raw of demands24h) {
          const demand = raw as DemandRow
          const appointmentDate = new Date(demand.appointment_date)
          if (!isWithinHoursBeforeWindow(appointmentDate, 24)) continue

          const canCustomer = reminder24hConfig.sendToCustomer && !!demand.customer_phone
          let specialistForSend: { phone: string; full_name: string | null } | null = null
          if (reminder24hConfig.sendToSpecialist && demand.assigned_specialist_id) {
            try {
              const { data: specialist } = await supabase
                .from('profiles')
                .select('phone, full_name')
                .eq('id', demand.assigned_specialist_id)
                .single()
              if (specialist?.phone) specialistForSend = { phone: specialist.phone, full_name: specialist.full_name }
            } catch {
              /* ignore */
            }
          }
          if (!canCustomer && !specialistForSend) continue

          const { data: claimed24h } = await supabase
            .from('demands')
            .update({ reminder_24h_sent_at: new Date().toISOString() })
            .eq('id', demand.id)
            .is('reminder_24h_sent_at', null)
            .select('id')
            .single()
          if (!claimed24h) continue

          const dealerCtx = dealerContext(demand)
          const customerMessage = buildCustomerSmsMessage('twenty_four_hour_reminder', rh24, demand, dealerCtx, {
            contactPhone: smsSettings.contactPhone,
            signature: smsSettings.signature,
            hoursText: '24 hours',
          })
          const specialistMessage = buildSpecialistSmsMessage('twenty_four_hour_reminder', rh24, demand, dealerCtx, {
            contactPhone: smsSettings.contactPhone,
            signature: smsSettings.signature,
            hoursText: '24 hours',
          })

          if (canCustomer && demand.customer_phone) {
            try {
              const result = await sendSMS(demand.customer_phone, customerMessage)
              if (result.success) {
                sentCount++
                logSmsAttempt(
                  {
                    phoneNumber: demand.customer_phone,
                    recipientType: 'customer',
                    recipientName: `${demand.customer_firstname ?? ''} ${demand.customer_lastname ?? ''}`.trim(),
                    demandId: demand.id,
                    messageType: 'twenty_four_hour_reminder',
                    triggeredBy: 'system',
                    messageContent: customerMessage,
                    twilioSid: result.success && 'sid' in result ? result.sid : undefined,
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
              const result = await sendSMS(specialistForSend.phone, specialistMessage)
              if (result.success) {
                sentCount++
                logSmsAttempt(
                  {
                    phoneNumber: specialistForSend.phone,
                    recipientType: 'specialist',
                    recipientName: specialistForSend.full_name ?? undefined,
                    demandId: demand.id,
                    messageType: 'twenty_four_hour_reminder',
                    triggeredBy: 'system',
                    messageContent: specialistMessage,
                    twilioSid: result.success && 'sid' in result ? result.sid : undefined,
                  },
                  supabase
                ).catch(() => {})
              } else errorCount++
            } catch {
              errorCount++
            }
          }
        }
      }
    }

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

        for (const raw of demands) {
          const demand = raw as DemandRow
          const appointmentDate = new Date(demand.appointment_date)
          if (!isWithinHoursBeforeWindow(appointmentDate, reminderConfig.hoursBefore)) continue
          if (!reminderConfig.sendToCustomer && !reminderConfig.sendToSpecialist) continue

          const { data: claimed4h } = await supabase
            .from('demands')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', demand.id)
            .is('reminder_sent_at', null)
            .select('id')
            .single()
          if (!claimed4h) continue

          const hoursText = reminderConfig.hoursBefore === 1 ? '1 hour' : `${reminderConfig.hoursBefore} hours`
          const dealerCtx = dealerContext(demand)
          const customerMessage = buildCustomerSmsMessage('four_hour_reminder', rh, demand, dealerCtx, {
            contactPhone: smsSettings.contactPhone,
            signature: smsSettings.signature,
            hoursText,
          })
          const specialistMessage = buildSpecialistSmsMessage('four_hour_reminder', rh, demand, dealerCtx, {
            contactPhone: smsSettings.contactPhone,
            signature: smsSettings.signature,
            hoursText,
          })

          if (reminderConfig.sendToCustomer && demand.customer_phone) {
            try {
              const result = await sendSMS(demand.customer_phone, customerMessage)
              if (result.success) {
                sentCount++
                logSmsAttempt({
                  phoneNumber: demand.customer_phone,
                  recipientType: 'customer',
                  recipientName: `${demand.customer_firstname ?? ''} ${demand.customer_lastname ?? ''}`.trim(),
                  demandId: demand.id,
                  messageType: 'four_hour_reminder',
                  triggeredBy: 'system',
                  messageContent: customerMessage,
                  twilioSid: result.success && 'sid' in result ? result.sid : undefined,
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

          if (reminderConfig.sendToSpecialist && demand.assigned_specialist_id) {
            try {
              const { data: specialist } = await supabase
                .from('profiles')
                .select('phone, full_name')
                .eq('id', demand.assigned_specialist_id)
                .single()
              if (specialist?.phone) {
                const result = await sendSMS(specialist.phone, specialistMessage)
                if (result.success) {
                  sentCount++
                  logSmsAttempt({
                    phoneNumber: specialist.phone,
                    recipientType: 'specialist',
                    recipientName: specialist.full_name ?? undefined,
                    demandId: demand.id,
                    messageType: 'four_hour_reminder',
                    triggeredBy: 'system',
                    messageContent: specialistMessage,
                    twilioSid: result.success && 'sid' in result ? result.sid : undefined,
                  }, supabase).catch(() => {})
                } else errorCount++
              }
            } catch {
              errorCount++
            }
          }
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

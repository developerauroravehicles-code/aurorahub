import { isDemoSmsPhone, sendSMS } from '@/lib/twilio'
import { logSmsSent } from '@/lib/sms-logger'

export async function sendDealerHandoffLinkSms(
  phone: string,
  portalUrl: string,
  demandId: string
): Promise<{ success: boolean; error?: string }> {
  if (isDemoSmsPhone(phone)) {
    return { success: true }
  }

  const message = [
    'Your Aurora dashcam installation appointment is booked.',
    'Confirm or update your contact details:',
    portalUrl,
  ].join(' ')

  const result = await sendSMS(phone, message)
  if (result.success) {
    logSmsSent({
      phoneNumber: phone,
      recipientType: 'customer',
      recipientName: 'Dealer handoff',
      demandId,
      messageType: 'appointment_created',
      triggeredBy: 'system',
      messageContent: message,
    }).catch(() => {})
    return { success: true }
  }

  const err = 'error' in result && typeof result.error === 'string' ? result.error : 'SMS failed'
  return { success: false, error: err }
}
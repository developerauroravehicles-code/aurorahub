import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export type SendSmsResult =
  | { success: true; mocked?: boolean; sid?: string }
  | { success: false; error: unknown; errorMessage: string }

/**
 * Converts a phone number to E.164 format required by Twilio
 */
export function formatPhoneNumberToE164(
  phoneNumber: string,
  defaultCountryCode?: string
): string {
  if (!phoneNumber) return phoneNumber

  const countryCode = defaultCountryCode || process.env.TWILIO_DEFAULT_COUNTRY_CODE || '1'

  let cleaned = phoneNumber.replace(/[^\d+]/g, '')

  if (cleaned.startsWith('+')) {
    return cleaned
  }

  if (countryCode === '1') {
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      cleaned = cleaned.substring(1)
    }
    cleaned = cleaned.replace(/^0+/, '')
    if (cleaned.length === 10) {
      return '+' + countryCode + cleaned
    }
  } else {
    cleaned = cleaned.replace(/^0+/, '')
  }

  if (!cleaned.startsWith(countryCode)) {
    cleaned = countryCode + cleaned
  }

  return '+' + cleaned
}

export async function sendSMS(to: string, body: string): Promise<SendSmsResult> {
  if (!process.env.TWILIO_ACCOUNT_SID) {
    console.log('Twilio credentials missing. SMS would be:', body)
    return { success: true, mocked: true }
  }

  try {
    const formattedNumber = formatPhoneNumberToE164(to)

    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedNumber,
    })
    return { success: true, sid: message.sid }
  } catch (error) {
    console.error('Twilio Error:', error)
    const errorMessage =
      error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : String(error ?? 'Send failed')
    return { success: false, error, errorMessage }
  }
}

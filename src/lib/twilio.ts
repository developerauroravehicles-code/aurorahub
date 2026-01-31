import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

/**
 * Converts a phone number to E.164 format required by Twilio
 * E.164 format: +[country code][number]
 * Examples:
 * - Turkey: +905551234567
 * - USA: +15551234567
 * 
 * @param phoneNumber - Phone number in any format
 * @param defaultCountryCode - Default country code if not present (default: '90' for Turkey)
 * @returns Phone number in E.164 format
 */
export function formatPhoneNumberToE164(phoneNumber: string, defaultCountryCode: string = '90'): string {
  if (!phoneNumber) return phoneNumber
  
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '')
  
  // If already starts with +, return as is (assuming it's already in E.164)
  if (cleaned.startsWith('+')) {
    return cleaned
  }
  
  // Remove leading zeros (common in Turkish numbers like 0555...)
  cleaned = cleaned.replace(/^0+/, '')
  
  // If it doesn't start with country code, add it
  if (!cleaned.startsWith(defaultCountryCode)) {
    cleaned = defaultCountryCode + cleaned
  }
  
  // Add + prefix
  return '+' + cleaned
}

export async function sendSMS(to: string, body: string) {
  if (!process.env.TWILIO_ACCOUNT_SID) {
      console.log('Twilio credentials missing. SMS would be:', body)
      return { success: true, mocked: true }
  }

  try {
    // Format phone number to E.164 before sending
    const formattedNumber = formatPhoneNumberToE164(to)
    
    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedNumber,
    })
    return { success: true }
  } catch (error) {
    console.error('Twilio Error:', error)
    return { success: false, error }
  }
}


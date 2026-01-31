import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

/**
 * Converts a phone number to E.164 format required by Twilio
 * E.164 format: +[country code][number]
 * Examples:
 * - Canada/USA: +15551234567
 * - Turkey: +905551234567
 * 
 * @param phoneNumber - Phone number in any format
 * @param defaultCountryCode - Default country code if not present (defaults to '1' for Canada/USA, or from env)
 * @returns Phone number in E.164 format
 */
export function formatPhoneNumberToE164(
  phoneNumber: string, 
  defaultCountryCode?: string
): string {
  if (!phoneNumber) return phoneNumber
  
  // Get default country code from env or use provided/default to '1' (Canada/USA)
  const countryCode = defaultCountryCode || process.env.TWILIO_DEFAULT_COUNTRY_CODE || '1'
  
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '')
  
  // If already starts with +, return as is (assuming it's already in E.164)
  if (cleaned.startsWith('+')) {
    return cleaned
  }
  
  // For North American numbers (country code 1), handle different formats
  if (countryCode === '1') {
    // Remove leading 1 if present (US/Canada numbers sometimes start with 1)
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      cleaned = cleaned.substring(1)
    }
    // Remove leading zeros
    cleaned = cleaned.replace(/^0+/, '')
    // North American numbers should be 10 digits
    if (cleaned.length === 10) {
      return '+' + countryCode + cleaned
    }
  } else {
    // For other countries (like Turkey), remove leading zeros
    cleaned = cleaned.replace(/^0+/, '')
  }
  
  // If it doesn't start with country code, add it
  if (!cleaned.startsWith(countryCode)) {
    cleaned = countryCode + cleaned
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


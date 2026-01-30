import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function sendSMS(to: string, body: string) {
  if (!process.env.TWILIO_ACCOUNT_SID) {
      console.log('Twilio credentials missing. SMS would be:', body)
      return { success: true, mocked: true }
  }

  try {
    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    })
    return { success: true }
  } catch (error) {
    console.error('Twilio Error:', error)
    return { success: false, error }
  }
}


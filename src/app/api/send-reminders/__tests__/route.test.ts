import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('send-reminders API', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  it('returns 401 when CRON_SECRET is not set', async () => {
    process.env.CRON_SECRET = ''
    const { GET } = await import('../route')
    const request = new Request('http://localhost/api/send-reminders', {
      method: 'GET',
      headers: { Authorization: 'Bearer some-secret' },
    })
    const response = await GET(request)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toContain('Unauthorized')
  })

  it('returns 401 when Authorization header is missing and no query secret', async () => {
    process.env.CRON_SECRET = 'test-cron-secret'
    const { GET } = await import('../route')
    const request = new Request('http://localhost/api/send-reminders', { method: 'GET' })
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it('accepts Bearer token when CRON_SECRET matches', async () => {
    process.env.CRON_SECRET = 'test-cron-secret'
    vi.doMock('@/lib/supabase/admin', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => ({
                  is: () => ({
                    not: () => Promise.resolve({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    }))
    vi.doMock('@/lib/automation-settings', () => ({
      getReminderAutomationConfig: () =>
        Promise.resolve({
          enabled: true,
          hoursBefore: 4,
          sendToCustomer: true,
          sendToSpecialist: true,
        }),
    }))

    const { GET } = await import('../route')
    const request = new Request('http://localhost/api/send-reminders', {
      method: 'GET',
      headers: { Authorization: 'Bearer test-cron-secret' },
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.sent).toBeDefined()
  })

  it('accepts secret as query param when CRON_SECRET matches', async () => {
    process.env.CRON_SECRET = 'query-secret-123'
    const { GET } = await import('../route')
    const request = new Request('http://localhost/api/send-reminders?secret=query-secret-123', {
      method: 'GET',
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
  })
})

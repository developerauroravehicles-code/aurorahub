import { describe, it, expect } from 'vitest'
import { buildChangePasswordUrl, getPasswordChangePublicOrigin } from '@/lib/password-change/token'

describe('password change URL', () => {
  it('builds change-password URL with explicit base', () => {
    const url = buildChangePasswordUrl('abc123', 'https://aurorahub.ca')
    expect(url).toBe('https://aurorahub.ca/auth/change-password?token=abc123')
  })

  it('ignores localhost NEXT_PUBLIC_APP_URL and uses production origin', () => {
    const prevApp = process.env.NEXT_PUBLIC_APP_URL
    const prevOverride = process.env.PASSWORD_CHANGE_PUBLIC_URL
    delete process.env.PASSWORD_CHANGE_PUBLIC_URL
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    try {
      expect(getPasswordChangePublicOrigin()).toBe('https://aurorahub.ca')
    } finally {
      if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL
      else process.env.NEXT_PUBLIC_APP_URL = prevApp
      if (prevOverride === undefined) delete process.env.PASSWORD_CHANGE_PUBLIC_URL
      else process.env.PASSWORD_CHANGE_PUBLIC_URL = prevOverride
    }
  })

  it('prefers PASSWORD_CHANGE_PUBLIC_URL when set', () => {
    const prev = process.env.PASSWORD_CHANGE_PUBLIC_URL
    process.env.PASSWORD_CHANGE_PUBLIC_URL = 'https://custom.example.com'
    try {
      expect(getPasswordChangePublicOrigin()).toBe('https://custom.example.com')
    } finally {
      if (prev === undefined) delete process.env.PASSWORD_CHANGE_PUBLIC_URL
      else process.env.PASSWORD_CHANGE_PUBLIC_URL = prev
    }
  })
})

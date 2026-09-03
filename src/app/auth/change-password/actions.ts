'use server'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { logIdentityEvent } from '@/lib/identity-audit'
import { getPasswordPromptSettings } from '@/lib/password-change/settings'
import { hashPasswordChangeToken, maskEmail } from '@/lib/password-change/token'
import { getNextPasswordPromptAtAfterChange } from '@/lib/password-change/prompt'

type TokenRow = {
  id: string
  user_id: string
  expires_at: string
  used_at: string | null
}

async function findValidTokenRow(token: string): Promise<{
  row: TokenRow | null
  email: string | null
}> {
  const trimmed = token?.trim()
  if (!trimmed) return { row: null, email: null }

  const admin = createAdminClient()
  const tokenHash = hashPasswordChangeToken(trimmed)

  const { data: row } = await admin
    .from('password_change_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!row || row.used_at) return { row: null, email: null }
  if (new Date(row.expires_at).getTime() < Date.now()) return { row: null, email: null }

  const { data: authUser } = await admin.auth.admin.getUserById(row.user_id)
  return { row, email: authUser.user?.email ?? null }
}

export async function validatePasswordChangeToken(token: string): Promise<{
  valid: boolean
  emailHint?: string
  supportEmail?: string
  supportPhone?: string
}> {
  const settings = await getPasswordPromptSettings()
  const { row, email } = await findValidTokenRow(token)

  if (!row || !email) {
    return {
      valid: false,
      supportEmail: settings.supportEmail,
      supportPhone: settings.supportPhone,
    }
  }

  return {
    valid: true,
    emailHint: maskEmail(email),
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
  }
}

export async function completePasswordChange(
  token: string,
  newPassword: string
): Promise<{ error?: string; success?: boolean }> {
  if (!newPassword || newPassword.length < 6) {
    return { error: 'Password must be at least 6 characters long' }
  }

  const { row, email } = await findValidTokenRow(token)
  if (!row || !email) {
    const settings = await getPasswordPromptSettings()
    return {
      error: `This link is invalid or has expired. Contact ${settings.supportEmail} for help.`,
    }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { error: passwordError } = await admin.auth.admin.updateUserById(row.user_id, {
    password: newPassword,
  })
  if (passwordError) return { error: passwordError.message }

  const nextPromptAt = await getNextPasswordPromptAtAfterChange()

  await admin
    .from('password_change_tokens')
    .update({ used_at: now })
    .eq('id', row.id)
    .is('used_at', null)

  await admin
    .from('profiles')
    .update({
      password_last_changed_at: now,
      next_password_prompt_at: nextPromptAt,
    })
    .eq('id', row.user_id)

  const h = await headers()
  await logIdentityEvent({
    eventType: 'password_reset',
    userId: row.user_id,
    email,
    ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null,
    userAgent: h.get('user-agent') ?? null,
    metadata: { source: 'self_service_email_link' },
  })

  return { success: true }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  isPasswordPromptDue,
  getNextPasswordPromptAtAfterDismiss,
} from '@/lib/password-change/prompt'
import { getPasswordPromptSettings } from '@/lib/password-change/settings'
import {
  generatePasswordChangeToken,
  hashPasswordChangeToken,
  tokenExpiresAt,
} from '@/lib/password-change/token'
import { sendPasswordChangeEmailMessage } from '@/lib/password-change/email'

const MAX_EMAIL_REQUESTS_PER_HOUR = 3

export async function getPasswordPromptState(): Promise<{
  show: boolean
  supportEmail: string
  supportPhone: string
  userEmail: string
}> {
  const supabase = await createClient()
  const settings = await getPasswordPromptSettings(supabase)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      show: false,
      supportEmail: settings.supportEmail,
      supportPhone: settings.supportPhone,
      userEmail: '',
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('password_last_changed_at, next_password_prompt_at, created_at')
    .eq('id', user.id)
    .maybeSingle()

  const show = profile
    ? isPasswordPromptDue(profile, settings.intervalDays)
    : false

  return {
    show,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    userEmail: user.email ?? '',
  }
}

export async function dismissPasswordPrompt(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const nextAt = await getNextPasswordPromptAtAfterDismiss()
  const { error } = await supabase
    .from('profiles')
    .update({ next_password_prompt_at: nextAt })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return {}
}

export async function sendPasswordChangeEmail(): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const settings = await getPasswordPromptSettings(supabase)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Not signed in' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('password_change_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', oneHourAgo)

  if ((count ?? 0) >= MAX_EMAIL_REQUESTS_PER_HOUR) {
    return { error: 'Too many password change requests. Please try again later.' }
  }

  await admin
    .from('password_change_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('used_at', null)

  const rawToken = generatePasswordChangeToken()
  const tokenHash = hashPasswordChangeToken(rawToken)
  const expiresAt = tokenExpiresAt(settings.tokenTtlHours)

  const { error: insertError } = await admin.from('password_change_tokens').insert({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  })

  if (insertError) return { error: insertError.message }

  const mailResult = await sendPasswordChangeEmailMessage({
    to: user.email,
    fullName: profile?.full_name ?? user.email,
    rawToken,
    settings,
  })

  if (!mailResult.success) {
    return { error: mailResult.error ?? 'Failed to send email' }
  }

  return { success: true }
}

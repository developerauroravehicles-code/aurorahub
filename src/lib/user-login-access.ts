import { createAdminClient } from '@/lib/supabase/admin'

const LONG_BAN_DURATION = '876000h' // ~100 years

export const LOGIN_ACCESS_DISABLED_MESSAGE =
  'Your access to the system has been disabled. Please contact your administrator.'

export type LoginAccessBlockReason = 'terminated' | 'suspended' | 'login_disabled'

export function formatLoginAuthError(message: string): string {
  const normalized = message.trim().toLowerCase()
  if (normalized.includes('banned') || normalized.includes('disabled')) {
    return LOGIN_ACCESS_DISABLED_MESSAGE
  }
  return message
}

export function isAuthUserBanned(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false
  return new Date(bannedUntil).getTime() > Date.now()
}

export async function getPersonnelLoginBlockReason(
  profileId: string
): Promise<LoginAccessBlockReason | null> {
  const admin = createAdminClient()
  const { data: personnel } = await admin
    .from('personnel')
    .select('status')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (personnel?.status === 'terminated') return 'terminated'
  if (personnel?.status === 'suspended') return 'suspended'
  return null
}

export async function isUserLoginDisabled(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user) return false
  return isAuthUserBanned(data.user.banned_until)
}

export async function setUserLoginEnabled(
  userId: string,
  enabled: boolean
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: enabled ? 'none' : LONG_BAN_DURATION,
  })
  if (error) return { error: error.message }
  return {}
}

export async function assertUserCanSignIn(userId: string): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const personnelBlock = await getPersonnelLoginBlockReason(userId)
  if (personnelBlock === 'terminated') {
    return { error: 'Your employment has ended. Contact HR if you believe this is an error.' }
  }
  if (personnelBlock === 'suspended') {
    return { error: 'Your account is suspended. Contact HR or IT.' }
  }

  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user) {
    return { error: 'Unable to verify account access.' }
  }
  if (isAuthUserBanned(data.user.banned_until)) {
    return { error: LOGIN_ACCESS_DISABLED_MESSAGE }
  }

  return {}
}

export function loginBlockMessage(reason: LoginAccessBlockReason): string {
  switch (reason) {
    case 'terminated':
      return 'Your employment has ended. Contact HR if you believe this is an error.'
    case 'suspended':
      return 'Your account is suspended. Contact HR or IT.'
    case 'login_disabled':
      return LOGIN_ACCESS_DISABLED_MESSAGE
  }
}

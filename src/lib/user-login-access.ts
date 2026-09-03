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
  clearUserLoginAccessCache(userId)
  return {}
}

const ACCESS_CHECK_TTL_MS = 90_000
const accessCheckCache = new Map<string, { result: { error?: string }; expiresAt: number }>()

export function clearUserLoginAccessCache(userId?: string) {
  if (userId) {
    accessCheckCache.delete(userId)
    return
  }
  accessCheckCache.clear()
}

export async function assertUserCanSignIn(
  userId: string,
  options?: { skipCache?: boolean }
): Promise<{ error?: string }> {
  if (!options?.skipCache) {
    const cached = accessCheckCache.get(userId)
    if (cached && cached.expiresAt > Date.now()) return cached.result
  }

  const admin = createAdminClient()
  const [personnelRes, authRes] = await Promise.all([
    admin.from('personnel').select('status').eq('profile_id', userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ])

  let result: { error?: string } = {}
  const status = personnelRes.data?.status
  if (status === 'terminated') {
    result = { error: 'Your employment has ended. Contact HR if you believe this is an error.' }
  } else if (status === 'suspended') {
    result = { error: 'Your account is suspended. Contact HR or IT.' }
  } else if (authRes.error || !authRes.data.user) {
    result = { error: 'Unable to verify account access.' }
  } else if (isAuthUserBanned(authRes.data.user.banned_until)) {
    result = { error: LOGIN_ACCESS_DISABLED_MESSAGE }
  }

  accessCheckCache.set(userId, { result, expiresAt: Date.now() + ACCESS_CHECK_TTL_MS })
  return result
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

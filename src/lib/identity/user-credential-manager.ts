export const USER_CREDENTIAL_MANAGER_ROLES = ['aurora_manager', 'hr', 'it'] as const

export type UserCredentialManagerRole = (typeof USER_CREDENTIAL_MANAGER_ROLES)[number]

export function isUserCredentialManager(role: string | null | undefined): boolean {
  return USER_CREDENTIAL_MANAGER_ROLES.includes(role as UserCredentialManagerRole)
}

export function normalizeAdminPassword(password: string): { password: string } | { error: string } {
  const trimmed = password.trim()
  if (!trimmed || trimmed.length < 6) {
    return { error: 'Password must be at least 6 characters long' }
  }
  return { password: trimmed }
}
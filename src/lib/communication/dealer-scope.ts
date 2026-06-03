import type { CommUserProfile } from './types'

const PLATFORM_ROLES = new Set(['aurora_manager', 'it', 'hr'])

export function isPlatformUser(profile: Pick<CommUserProfile, 'dealer_id' | 'role'>): boolean {
  if (profile.dealer_id == null) return true
  return PLATFORM_ROLES.has(profile.role)
}

/**
 * Whether currentUser can start a conversation with targetUser.
 * Platform users can message anyone; dealer users only same-dealer profiles.
 */
export function canMessageUser(
  currentUser: Pick<CommUserProfile, 'id' | 'dealer_id' | 'role'>,
  targetUser: Pick<CommUserProfile, 'id' | 'dealer_id' | 'role'>
): boolean {
  if (currentUser.id === targetUser.id) return false
  if (isPlatformUser(currentUser)) return true
  if (isPlatformUser(targetUser)) return true
  return currentUser.dealer_id === targetUser.dealer_id
}

/**
 * Resolve dealer_id for a new conversation based on participants.
 */
export function resolveConversationDealerId(
  creator: Pick<CommUserProfile, 'dealer_id' | 'role'>,
  memberDealerIds: (string | null)[]
): string | null {
  if (isPlatformUser(creator)) {
    const dealerIds = memberDealerIds.filter((d): d is string => d != null)
    const unique = [...new Set(dealerIds)]
    if (unique.length === 1) return unique[0]
    return null
  }
  return creator.dealer_id
}

export function canAccessDealerScope(
  currentUser: Pick<CommUserProfile, 'dealer_id' | 'role'>,
  scopeDealerId: string | null
): boolean {
  if (isPlatformUser(currentUser)) return true
  if (scopeDealerId == null) return true
  return currentUser.dealer_id === scopeDealerId
}

export function filterMessageableProfiles(
  currentUser: Pick<CommUserProfile, 'id' | 'dealer_id' | 'role'>,
  profiles: CommUserProfile[]
): CommUserProfile[] {
  return profiles.filter((p) => canMessageUser(currentUser, p))
}

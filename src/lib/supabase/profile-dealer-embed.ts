/**
 * PostgREST embed hint for profiles → dealers (profiles.dealer_id).
 * Use instead of bare `dealers(...)` after CRM added dealers.acquired_by_profile_id → profiles.
 */
export const PROFILE_DEALER_EMBED_NAME = 'dealers!profiles_dealer_id_fkey(name)' as const
export const PROFILE_DEALER_EMBED_NAME_CODE = 'dealers!profiles_dealer_id_fkey(name, code)' as const
export const PROFILE_DEALER_EMBED_ID_NAME_CODE = 'dealers!profiles_dealer_id_fkey(id, name, code)' as const
export const PROFILE_DEALER_EMBED_CODE = 'dealers!profiles_dealer_id_fkey(code)' as const
export const PROFILE_DEALER_EMBED_ALIAS_ID_NAME_CODE =
  'dealer:dealers!profiles_dealer_id_fkey(id, name, code)' as const
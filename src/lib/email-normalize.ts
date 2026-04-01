/**
 * Normalize email for auth and storage: trim + lowercase.
 * (Mailbox providers treat addresses as case-insensitive; Supabase stores lowercase.)
 */
export function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

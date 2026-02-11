/**
 * Extract dealer timezone name from Supabase dealer/region_codes response.
 * Handles both single objects and arrays (Supabase can return nested arrays from joins).
 */
export function getTimezoneFromDealer(dealer: {
  region_codes?: { timezone_id?: unknown; timezones?: { name: string } | Array<{ name: string }> } | Array<{ timezone_id?: unknown; timezones?: { name: string } | Array<{ name: string }> }>;
} | null): string | null {
  const rc = dealer?.region_codes
  if (!rc) return null
  const r = Array.isArray(rc) ? rc[0] : rc
  const tz = r?.timezones
  if (!tz) return null
  const t = Array.isArray(tz) ? tz[0] : tz
  return (t as { name?: string })?.name ?? null
}

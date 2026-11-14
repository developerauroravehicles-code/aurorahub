export function regionCodeLabel(
  region: { name: string; code: string } | { name: string; code: string }[] | null | undefined
): string | null {
  if (!region) return null
  if (Array.isArray(region)) return region[0]?.name ?? null
  return region.name ?? null
}
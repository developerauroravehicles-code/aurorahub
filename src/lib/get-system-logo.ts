import { getCachedSystemLogo } from '@/lib/cached-reference-data'

/** Read system logo from settings (Server Components / route handlers only). */
export async function getSystemLogo(): Promise<string | null> {
  return getCachedSystemLogo()
}

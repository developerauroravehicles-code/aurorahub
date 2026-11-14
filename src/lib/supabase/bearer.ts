import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

/** Extracts the token from an `Authorization: Bearer <token>` header. */
export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  const token = match?.[1]?.trim()
  return token ? token : null
}

/**
 * Supabase client that acts as the user who owns `accessToken`, so RLS and
 * `auth.uid()` behave exactly as they do for the cookie-based web session.
 * Used by the mobile field API (AuroraField).
 */
export function createBearerClient(accessToken: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Missing Supabase environment variables')
  }
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

export type BearerAuthResult =
  | { supabase: SupabaseClient; user: User }
  | { error: string; status: 401 }

/** Validates the request's Bearer token with Supabase Auth. */
export async function authenticateBearer(request: Request): Promise<BearerAuthResult> {
  const token = getBearerToken(request)
  if (!token) return { error: 'Missing bearer token', status: 401 }

  const supabase = createBearerClient(token)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return { error: 'Invalid or expired token', status: 401 }

  return { supabase, user: data.user }
}

import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { authenticateBearer } from '@/lib/supabase/bearer'
import { assertUserCanSignIn } from '@/lib/user-login-access'

export type FieldContext = {
  supabase: SupabaseClient
  user: User
  profile: { id: string; full_name: string | null; role: string; dealer_id: string | null }
}

export function fieldError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Authenticates a mobile field request: valid Supabase access token, account
 * not suspended/terminated, and role `specialist`.
 */
export async function requireFieldSpecialist(
  request: Request
): Promise<FieldContext | NextResponse> {
  const auth = await authenticateBearer(request)
  if ('error' in auth) return fieldError(auth.error, auth.status)

  const access = await assertUserCanSignIn(auth.user.id)
  if (access.error) return fieldError(access.error, 403)

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('id, full_name, role, dealer_id')
    .eq('id', auth.user.id)
    .single()

  if (!profile || profile.role !== 'specialist') {
    return fieldError('Only specialists can use the field app', 403)
  }

  return { supabase: auth.supabase, user: auth.user, profile }
}

/** Parses a JSON body; returns null for missing/invalid JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

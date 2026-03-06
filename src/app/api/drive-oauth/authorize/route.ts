/**
 * OAuth 2.0 - Redirect to Google consent screen.
 * Use when Service Account key creation is disabled by org policy.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!['aurora_manager', 'it'].includes(profile?.role ?? '')) {
    return NextResponse.redirect(new URL('/dashboard/integrations/external-apis?drive_error=unauthorized', request.url))
  }

  const { searchParams } = new URL(request.url)
  const connectionId = searchParams.get('connection_id')
  let settings: Record<string, unknown> = {}
  if (connectionId) {
    const { data: conn } = await supabase.from('external_api_connections').select('config').eq('id', connectionId).single()
    settings = (conn?.config as Record<string, unknown>) ?? {}
  } else {
    const { data: row } = await supabase.from('system_settings').select('value').eq('key', 'google_drive_settings').single()
    settings = row?.value ? (JSON.parse(row.value) as Record<string, unknown>) : {}
  }
  const clientId = (settings.clientId as string)?.trim()
  if (!clientId) {
    return NextResponse.redirect(new URL('/dashboard/integrations/external-apis?drive_error=no_client_id', request.url))
  }

  const origin = new URL(request.url).origin
  const redirectUri = `${origin}/api/drive-oauth/callback`
  const state = Buffer.from(JSON.stringify({ ts: Date.now(), connectionId: connectionId ?? null })).toString('base64url')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent', // Force refresh_token
    state
  })

  const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  return NextResponse.redirect(googleUrl)
}

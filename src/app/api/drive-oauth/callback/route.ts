/**
 * OAuth 2.0 callback - Exchange code for refresh_token and save.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const redirectUrl = new URL('/dashboard/system-management/api', request.url)
  redirectUrl.searchParams.set('drive', 'settings')

  if (error) {
    redirectUrl.searchParams.set('drive_error', `oauth_${error}`)
    return NextResponse.redirect(redirectUrl)
  }
  if (!code) {
    redirectUrl.searchParams.set('drive_error', 'no_code')
    return NextResponse.redirect(redirectUrl)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirectUrl.searchParams.set('drive_error', 'session_expired')
    return NextResponse.redirect(redirectUrl)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'aurora_manager') {
    redirectUrl.searchParams.set('drive_error', 'unauthorized')
    return NextResponse.redirect(redirectUrl)
  }

  const { data: row } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'google_drive_settings')
    .single()

  const settings = row?.value ? JSON.parse(row.value) : {}
  const clientId = settings.clientId?.trim()
  const clientSecret = settings.clientSecret?.trim()
  if (!clientId || !clientSecret) {
    redirectUrl.searchParams.set('drive_error', 'no_credentials')
    return NextResponse.redirect(redirectUrl)
  }

  const origin = new URL(request.url).origin
  const redirectUri = `${origin}/api/drive-oauth/callback`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  })

  if (!tokenRes.ok) {
    const errData = await tokenRes.json().catch(() => ({}))
    redirectUrl.searchParams.set('drive_error', errData.error || 'token_exchange_failed')
    return NextResponse.redirect(redirectUrl)
  }

  const tokens = await tokenRes.json()
  const refreshToken = tokens.refresh_token
  if (!refreshToken) {
    redirectUrl.searchParams.set('drive_error', 'no_refresh_token')
    return NextResponse.redirect(redirectUrl)
  }

  const updatedSettings = {
    ...settings,
    refreshToken,
    useOAuth: true
  }

  await supabase
    .from('system_settings')
    .upsert({
      key: 'google_drive_settings',
      value: JSON.stringify(updatedSettings),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })

  redirectUrl.searchParams.set('drive', 'connected')
  return NextResponse.redirect(redirectUrl)
}

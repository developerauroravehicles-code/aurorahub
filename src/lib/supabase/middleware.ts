import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  try {
  let supabaseResponse = NextResponse.next({
    request,
  })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables')
      // Return response even if env vars are missing to avoid 404
      return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
            cookiesToSet.forEach(({ name, value, options }) => {
              // Ensure each user has isolated cookies
              supabaseResponse.cookies.set(name, value, {
                ...options,
                sameSite: 'lax' as const,
                path: '/',
                // Don't set httpOnly here - let Supabase handle it
              })
            })
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // Cron API routes use CRON_SECRET; skip auth entirely - return immediately
  const cronPaths = [
    '/api/send-reminders',
    '/api/send-lifecycle-sms',
    '/api/send-scheduled-reports',
    '/api/check-low-stock',
    '/api/inventory-stock-notify',
    '/api/run-alerts',
    '/api/daily-invoice-review-notify',
    '/api/daily-invoice-auto-send',
    '/api/daily-invoice-eod-notify',
    '/api/crm-note-reminders',
  ]
  const isCronApi = cronPaths.some((p) =>
    request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(p + '/')
  )
  if (isCronApi) {
    return supabaseResponse
  }

  // Mobile field API (AuroraField) authenticates with a Bearer access token
  // inside each route handler; it never uses cookie sessions.
  if (
    request.nextUrl.pathname === '/api/field' ||
    request.nextUrl.pathname.startsWith('/api/field/')
  ) {
    // Dev only: let the Expo web preview (http://<host>:8081) call the API from a browser.
    // Native apps don't need CORS; production never sends these headers.
    const origin = request.headers.get('origin')
    if (process.env.NODE_ENV !== 'production' && origin && /^http:\/\/[^/]+:8081$/.test(origin)) {
      const cors = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        Vary: 'Origin',
      }
      if (request.method === 'OPTIONS') return new NextResponse(null, { status: 204, headers: cors })
      for (const [k, v] of Object.entries(cors)) supabaseResponse.headers.set(k, v)
    }
    return supabaseResponse
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/customer-portal') &&
    !request.nextUrl.pathname.startsWith('/api/qr') &&
    !request.nextUrl.pathname.startsWith('/api/customer-portal') &&
    request.nextUrl.pathname !== '/' // Allow access to landing page
  ) {
    // no user, potentially redirect to login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
    try {
      const { assertUserCanSignIn } = await import('@/lib/user-login-access')
      const accessCheck = await assertUserCanSignIn(user.id)
      if (accessCheck.error) {
        await supabase.auth.signOut()
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('reason', 'access_revoked')
        return NextResponse.redirect(url)
      }
    } catch (accessError) {
      console.error('Login access check failed:', accessError)
    }
  }

  // If user is logged in and trying to access login page, redirect to dashboard
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
  } catch (error) {
    // If there's an error, return a response to avoid 404
    console.error('Middleware error:', error)
    return NextResponse.next({
      request,
    })
  }
}


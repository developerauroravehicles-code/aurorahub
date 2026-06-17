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
    '/api/send-scheduled-reports',
    '/api/check-low-stock',
    '/api/daily-invoice-review-notify',
    '/api/daily-invoice-auto-send',
  ]
  const isCronApi = cronPaths.some((p) =>
    request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(p + '/')
  )
  if (isCronApi) {
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
    request.nextUrl.pathname !== '/' // Allow access to landing page
  ) {
    // no user, potentially redirect to login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
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


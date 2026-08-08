import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { LOCAL_ADMIN_COOKIE, isLocalAdminEnabled, isLocalHost } from '@/lib/local-admin'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const protectedPaths = ['/lobby', '/blackjack', '/baccarat', '/table', '/profile']
  const authPaths = ['/auth/login', '/auth/register']
  const isProtected = request.nextUrl.pathname === '/' || protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p))
  const isAuthPage = authPaths.some((p) => request.nextUrl.pathname.startsWith(p))
  const isLocalAdmin = isLocalAdminEnabled()
    && isLocalHost(request.nextUrl.hostname)
    && request.cookies.get(LOCAL_ADMIN_COOKIE)?.value === 'true'

  let isVerified = isLocalAdmin
  if (session) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    isVerified = !!user?.email_confirmed_at
  }

  if (isProtected && !session && !isLocalAdmin) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (isProtected && session && !isVerified) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/auth/login?unverified=true', request.url))
  }

  if (isAuthPage && session && isVerified) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
  const protectedPaths = ['/lobby', '/table', '/profile']
  const authPaths = ['/auth/login', '/auth/register']
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p))
  const isAuthPage = authPaths.some((p) => request.nextUrl.pathname.startsWith(p))

  let isVerified = false
  if (session) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    isVerified = !!user?.email_confirmed_at
  }

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (isProtected && session && !isVerified) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/auth/login?unverified=true', request.url))
  }

  if (isAuthPage && session && isVerified) {
    return NextResponse.redirect(new URL('/lobby', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}

import { NextResponse, type NextRequest } from 'next/server'
import { LOCAL_ADMIN_COOKIE, isLocalAdminEnabled, isLocalHost } from '@/lib/local-admin'

export function GET(request: NextRequest) {
  if (!isLocalAdminEnabled() || !isLocalHost(request.nextUrl.hostname)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const response = NextResponse.redirect(new URL('/auth/login', request.url))
  response.cookies.set(LOCAL_ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}

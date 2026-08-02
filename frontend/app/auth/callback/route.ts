import { createClient } from '@/lib/supabase/server'
import { ensureProfileExists } from '@/lib/profile'
import { getServerSiteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const next = searchParams.get('next')
  const siteUrl = getServerSiteUrl(origin)
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/'

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.session) {
      const user = data.session.user
      const { error: profileError } = await ensureProfileExists(supabase, user)
      const params = new URLSearchParams({
        verified: 'true',
        profile: profileError ? 'failed' : 'ok',
      })

      if (type === 'recovery') {
        return NextResponse.redirect(`${siteUrl}${safeNext}?recovery=1`)
      }

      return NextResponse.redirect(`${siteUrl}/auth/login?${params.toString()}`)
    }

    if (type === 'recovery') {
      return NextResponse.redirect(`${siteUrl}/auth/reset-password?recovery=failed`)
    }
  }

  return NextResponse.redirect(`${siteUrl}/auth/login?verified=false`)
}

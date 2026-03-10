import { createClient } from '@/lib/supabase/server'
import { ensureProfileExists } from '@/lib/profile'
import { getServerSiteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const siteUrl = getServerSiteUrl(origin)

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

      return NextResponse.redirect(`${siteUrl}/auth/login?${params.toString()}`)
    }
  }

  return NextResponse.redirect(`${siteUrl}/auth/login?verified=false`)
}

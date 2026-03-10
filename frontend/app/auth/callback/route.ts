import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.session) {
      const user = data.session.user
      const username =
        user.user_metadata?.username ??
        user.email?.split('@')[0] ??
        'Player'

      // Create profile if the trigger didn't (ignoreDuplicates so we don't overwrite existing)
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          username,
          chip_balance: 10000,
          games_played: 0,
          games_won: 0,
          avatar: 'avatar_m1',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )

      return NextResponse.redirect(`${origin}/auth/login?verified=true`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?verified=false`)
}

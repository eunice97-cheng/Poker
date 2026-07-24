import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { BlackjackLobbyClient } from './BlackjackLobbyClient'
import type { BlackjackTableInfo } from '@/types/blackjack'
import { LOCAL_ADMIN_COOKIE, LOCAL_ADMIN_TOKEN, isLocalAdminEnabled } from '@/lib/local-admin'

export default async function BlackjackLobbyPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const isLocalAdmin = isLocalAdminEnabled() && cookies().get(LOCAL_ADMIN_COOKIE)?.value === 'true'

  if (!session && !isLocalAdmin) redirect('/auth/login')

  if (isLocalAdmin && !session) {
    return (
      <BlackjackLobbyClient
        initialTables={[]}
        profile={{
          id: 'local-admin',
          username: 'LocalAdmin',
          chip_balance: 100000,
          games_played: 0,
          games_won: 0,
          avatar: 'avatar_m1',
          created_at: new Date().toISOString(),
        }}
        token={LOCAL_ADMIN_TOKEN}
        isLocalAdmin
      />
    )
  }

  const [{ data: tables }, { data: profile }] = await Promise.all([
    supabase
      .from('tables')
      .select('*')
      .eq('game_type', 'blackjack')
      .neq('status', 'finished')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').eq('id', session!.user.id).single(),
  ])

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4 text-center text-white">
        <div>
          <p className="mb-4 text-lg text-red-300">Profile not found.</p>
          <Link href="/lobby" className="text-amber-300 hover:underline">Back to Poker Lounge</Link>
        </div>
      </main>
    )
  }

  return (
    <BlackjackLobbyClient
      initialTables={(tables ?? []) as BlackjackTableInfo[]}
      profile={profile}
      token={session!.access_token}
      isLocalAdmin={false}
    />
  )
}

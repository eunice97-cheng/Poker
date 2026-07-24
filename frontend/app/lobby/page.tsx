import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { hasVipEmojiAccess } from '@/lib/supporter-access'
import { LobbyClient } from './LobbyClient'
import { TableInfo } from '@/types/poker'
import { isAdminEmail } from '@/lib/admin'
import { LOCAL_ADMIN_COOKIE, LOCAL_ADMIN_TOKEN, isLocalAdminEnabled } from '@/lib/local-admin'

export default async function LobbyPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const isLocalAdmin = isLocalAdminEnabled() && cookies().get(LOCAL_ADMIN_COOKIE)?.value === 'true'

  if (!session && !isLocalAdmin) redirect('/auth/login')

  if (isLocalAdmin && !session) {
    return (
      <LobbyClient
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
        unreadMailCount={0}
        isAdmin
        hasVipEmojis
        isLocalAdmin
      />
    )
  }

  const user = session!.user

  const [{ data: tables }, { data: profile }, canUseVipEmojis, { count: unreadMailCount }] = await Promise.all([
    supabase.from('tables').select('*').eq('game_type', 'poker').neq('status', 'finished').not('name', 'ilike', '%Dev Table%').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    hasVipEmojiAccess(supabase, user.id, user.email),
    supabase
      .from('player_mail')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', user.id)
      .eq('is_read', false),
  ])

  return (
    <LobbyClient
      initialTables={(tables ?? []) as TableInfo[]}
      profile={profile}
      token={session!.access_token}
      unreadMailCount={unreadMailCount ?? 0}
      isAdmin={isAdminEmail(user.email)}
      hasVipEmojis={canUseVipEmojis}
      isLocalAdmin={false}
    />
  )
}

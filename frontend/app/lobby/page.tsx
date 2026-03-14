import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasVipEmojiAccess } from '@/lib/supporter-access'
import { LobbyClient } from './LobbyClient'
import { TableInfo } from '@/types/poker'
import { isAdminEmail } from '@/lib/admin'

export default async function LobbyPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) redirect('/auth/login')

  const user = session.user

  const [{ data: tables }, { data: profile }, canUseVipEmojis, { count: unreadMailCount }] = await Promise.all([
    supabase.from('tables').select('*').neq('status', 'finished').not('name', 'ilike', '%Dev Table%').order('created_at', { ascending: false }),
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
      token={session.access_token}
      unreadMailCount={unreadMailCount ?? 0}
      isAdmin={isAdminEmail(user.email)}
      hasVipEmojis={canUseVipEmojis}
    />
  )
}

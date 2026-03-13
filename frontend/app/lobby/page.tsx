import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasVipEmojiAccess } from '@/lib/supporter-access'
import { LobbyClient } from './LobbyClient'
import { TableInfo } from '@/types/poker'
import { isAdminEmail } from '@/lib/admin'

export default async function LobbyPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: { session } }, { data: tables }, { data: profile }, canUseVipEmojis] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from('tables').select('*').neq('status', 'finished').not('name', 'ilike', '%Dev Table%').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').eq('id', user?.id ?? '').single(),
    hasVipEmojiAccess(supabase, user?.id),
  ])

  if (!session) redirect('/auth/login')

  return (
    <LobbyClient
      initialTables={(tables ?? []) as TableInfo[]}
      profile={profile}
      token={session.access_token}
      isAdmin={isAdminEmail(user?.email)}
      hasVipEmojis={canUseVipEmojis}
    />
  )
}

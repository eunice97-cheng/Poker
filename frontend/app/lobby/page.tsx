import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LobbyClient } from './LobbyClient'
import { TableInfo } from '@/types/poker'

export default async function LobbyPage() {
  const supabase = createClient()

  const [{ data: { session } }, { data: tables }, { data: profile }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from('tables').select('*').neq('status', 'finished').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').eq('id', (await supabase.auth.getUser()).data.user?.id ?? '').single(),
  ])

  if (!session) redirect('/auth/login')

  return (
    <LobbyClient
      initialTables={(tables ?? []) as TableInfo[]}
      profile={profile}
      token={session.access_token}
    />
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { ProfileClient } from './ProfileClient'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const [{ data: profile }, { data: hands }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', session.user.id).single(),
    supabase
      .from('hand_history')
      .select('id, hand_number, community, pot_total, winners, ended_at')
      .order('ended_at', { ascending: false })
      .limit(20),
  ])

  return (
    <ProfileClient
      initialProfile={profile}
      handHistory={hands ?? []}
      userId={session.user.id}
      email={session.user.email ?? ''}
      isAdmin={isAdminEmail(session.user.email)}
    />
  )
}

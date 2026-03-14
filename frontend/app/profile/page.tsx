import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { getWeekendLoyaltyStatus } from '@/lib/weekend-loyalty'
import { ProfileClient } from './ProfileClient'

type ProfilePageProps = {
  searchParams?: {
    tab?: string | string[]
  }
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const requestedTab = Array.isArray(searchParams?.tab) ? searchParams?.tab[0] : searchParams?.tab
  const initialTab =
    requestedTab === 'stats' || requestedTab === 'hands' || requestedTab === 'mail'
      ? requestedTab
      : 'profile'

  const [{ data: profile }, { data: hands }, { data: mail }, { count: unreadMailCount }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', session.user.id).single(),
    supabase
      .from('hand_history')
      .select('id, hand_number, community, pot_total, winners, ended_at')
      .order('ended_at', { ascending: false })
      .limit(20),
    supabase
      .from('player_mail')
      .select('id, category, subject, body, is_read, created_at')
      .eq('player_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('player_mail')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', session.user.id)
      .eq('is_read', false),
  ])

  const loyaltyStatus = getWeekendLoyaltyStatus(profile?.last_weekend_loyalty_claim_at ?? null)

  return (
    <ProfileClient
      initialProfile={profile}
      initialLoyaltyStatus={loyaltyStatus}
      initialMail={mail ?? []}
      initialUnreadMailCount={unreadMailCount ?? 0}
      initialTab={initialTab}
      handHistory={hands ?? []}
      userId={session.user.id}
      email={session.user.email ?? ''}
      isAdmin={isAdminEmail(session.user.email)}
    />
  )
}

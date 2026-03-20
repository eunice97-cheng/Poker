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
      .select('id, hand_number, community, pot_total, winners, players, ended_at')
      .filter('players', 'cs', JSON.stringify([{ player_id: session.user.id }]))
      .order('ended_at', { ascending: false })
      .limit(10),
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
  const handHistory = (hands ?? []).map((hand) => {
    const storedPlayers = Array.isArray(hand.players) ? (hand.players as Array<Record<string, unknown>>) : []
    const storedWinners = Array.isArray(hand.winners) ? (hand.winners as Array<Record<string, unknown>>) : []
    const myPlayer = storedPlayers.find((player) => player.player_id === session.user.id)

    return {
      id: hand.id,
      hand_number: hand.hand_number,
      community: Array.isArray(hand.community)
        ? hand.community.filter((card): card is string => typeof card === 'string')
        : [],
      pot_total: Number(hand.pot_total ?? 0),
      winners: storedWinners.map((winner) => ({
        playerId: typeof winner.playerId === 'string' ? winner.playerId : '',
        username: typeof winner.username === 'string' ? winner.username : 'Unknown',
        amount: typeof winner.amount === 'number' ? winner.amount : Number(winner.amount ?? 0),
        handRank: typeof winner.handRank === 'string' ? winner.handRank : 'Unknown hand',
        potCount: typeof winner.potCount === 'number' ? winner.potCount : undefined,
      })),
      my_hole_cards: Array.isArray(myPlayer?.hole_cards)
        ? myPlayer.hole_cards.filter((card): card is string => typeof card === 'string')
        : [],
      ended_at: hand.ended_at,
    }
  })

  return (
    <ProfileClient
      initialProfile={profile}
      initialLoyaltyStatus={loyaltyStatus}
      initialMail={mail ?? []}
      initialUnreadMailCount={unreadMailCount ?? 0}
      initialTab={initialTab}
      handHistory={handHistory}
      userId={session.user.id}
      email={session.user.email ?? ''}
      isAdmin={isAdminEmail(session.user.email)}
    />
  )
}

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { CasinoLobbyClient, type CasinoGameStats } from './CasinoLobbyClient'
import { LOCAL_ADMIN_COOKIE, isLocalAdminEnabled } from '@/lib/local-admin'
import type { Profile } from '@/types/poker'

type CasinoTableRow = {
  small_blind: number | null
  big_blind: number | null
  max_players: number | null
  player_count: number | null
  status: string | null
}

function buildGameStats(tables: CasinoTableRow[] | null | undefined): CasinoGameStats {
  const activeTables = (tables ?? []).filter((table) => table.status !== 'finished')
  const tableCount = activeTables.length
  const playerCount = activeTables.reduce((sum, table) => sum + (table.player_count ?? 0), 0)
  const openSeats = activeTables.reduce(
    (sum, table) => sum + Math.max((table.max_players ?? 0) - (table.player_count ?? 0), 0),
    0
  )
  const featured = [...activeTables].sort(
    (a, b) => (b.player_count ?? 0) - (a.player_count ?? 0) || (b.big_blind ?? 0) - (a.big_blind ?? 0)
  )[0]

  return {
    tableCount,
    playerCount,
    openSeats,
    featuredLimit: featured ? `${featured.small_blind ?? 0}/${featured.big_blind ?? 0} table live` : 'No live table yet',
  }
}

export default async function HomePage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const isLocalAdmin = isLocalAdminEnabled() && cookies().get(LOCAL_ADMIN_COOKIE)?.value === 'true'

  if (!session && !isLocalAdmin) {
    redirect('/auth/login')
  }

  if (isLocalAdmin && !session) {
    return (
      <CasinoLobbyClient
        profile={{
          id: 'local-admin',
          username: 'LocalAdmin',
          chip_balance: 100000,
          games_played: 0,
          games_won: 0,
          avatar: 'avatar_m1',
          created_at: new Date().toISOString(),
        }}
        pokerStats={buildGameStats([])}
        blackjackStats={buildGameStats([])}
        unreadMailCount={0}
        isLocalAdmin
      />
    )
  }

  const user = session!.user
  const [{ data: pokerTables }, { data: blackjackTables }, { data: profile }, { count: unreadMailCount }] =
    await Promise.all([
      supabase
        .from('tables')
        .select('small_blind,big_blind,max_players,player_count,status')
        .eq('game_type', 'poker')
        .neq('status', 'finished')
        .not('name', 'ilike', '%Dev Table%'),
      supabase
        .from('tables')
        .select('small_blind,big_blind,max_players,player_count,status')
        .eq('game_type', 'blackjack')
        .neq('status', 'finished'),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('player_mail')
        .select('id', { count: 'exact', head: true })
        .eq('player_id', user.id)
        .eq('is_read', false),
    ])

  return (
    <CasinoLobbyClient
      profile={profile as Profile | null}
      pokerStats={buildGameStats(pokerTables as CasinoTableRow[])}
      blackjackStats={buildGameStats(blackjackTables as CasinoTableRow[])}
      unreadMailCount={unreadMailCount ?? 0}
      isLocalAdmin={false}
    />
  )
}

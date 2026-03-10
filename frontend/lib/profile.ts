import type { SupabaseClient, User } from '@supabase/supabase-js'

export async function ensureProfileExists(supabase: SupabaseClient, user: User) {
  const username =
    user.user_metadata?.username ??
    user.email?.split('@')[0] ??
    'Player'

  const { error } = await supabase.from('profiles').upsert(
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

  return { error }
}

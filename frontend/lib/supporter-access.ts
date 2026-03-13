import type { SupabaseClient } from '@supabase/supabase-js'
import { isAdminEmail } from '@/lib/admin'

export async function hasVipEmojiAccess(
  supabase: SupabaseClient,
  userId?: string | null,
  email?: string | null
) {
  if (isAdminEmail(email)) return true
  if (!userId) return false

  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', userId)
    .eq('type', 'kofi_redeem')

  if (error) {
    throw new Error(`Failed to determine VIP emoji access: ${error.message}`)
  }

  return (count ?? 0) > 0
}

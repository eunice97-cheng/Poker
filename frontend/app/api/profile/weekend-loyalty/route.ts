import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getErrorStatus(message: string) {
  if (/unauthorized/i.test(message)) return 401
  if (/weekend loyalty|player not found|claim/i.test(message)) return 400
  return 500
}

export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Weekend loyalty chips require a verified account.' }, { status: 403 })
  }

  const { data, error } = await supabase.rpc('claim_weekend_loyalty_chips')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: getErrorStatus(error.message) })
  }

  const result = Array.isArray(data) ? data[0] : data

  if (!result) {
    return NextResponse.json({ error: 'No loyalty reward data returned.' }, { status: 500 })
  }

  const { data: mailRows } = await supabase
    .from('player_mail')
    .select('id, category, subject, body, is_read, created_at')
    .eq('player_id', user.id)
    .eq('subject', 'Weekend loyalty bonus received')
    .gte('created_at', result.claimed_at)
    .order('created_at', { ascending: false })
    .limit(1)

  revalidatePath('/profile')
  revalidatePath('/lobby')

  return NextResponse.json({
    chips: Number(result.chips ?? 0),
    newBalance: Number(result.new_balance ?? 0),
    claimedAt: result.claimed_at,
    nextClaimAt: result.next_claim_at,
    mail: mailRows?.[0] ?? null,
  })
}

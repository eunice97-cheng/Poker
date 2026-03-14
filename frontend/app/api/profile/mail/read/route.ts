import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('player_mail')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('player_id', user.id)
    .eq('is_read', false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePath('/profile')
  revalidatePath('/lobby')

  return NextResponse.json({ ok: true })
}

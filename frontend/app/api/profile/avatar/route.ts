import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { isAvatarSelectable } from '@/lib/avatars'

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const avatar = String(body.avatar ?? '').trim()
  const isAdmin = isAdminEmail(user.email)

  if (!avatar) {
    return NextResponse.json({ error: 'avatar is required' }, { status: 400 })
  }

  if (!isAvatarSelectable(avatar, isAdmin)) {
    return NextResponse.json({ error: 'That avatar is not available for this account' }, { status: 403 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, avatar })
}

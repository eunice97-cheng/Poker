import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { hasVipEmojiAccess } from '@/lib/supporter-access'
import { LOCAL_ADMIN_COOKIE, isLocalAdminEnabled } from '@/lib/local-admin'
import { BaccaratRoomClient } from './BaccaratRoomClient'

type RoomProfile = {
  username: string | null
  chip_balance: number | null
}

export default async function BaccaratRoomPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const isLocalAdmin = isLocalAdminEnabled() && cookies().get(LOCAL_ADMIN_COOKIE)?.value === 'true'
  const canViewRoom = isLocalAdmin || Boolean(session?.user.email && isAdminEmail(session.user.email))

  if (!session && !isLocalAdmin) redirect('/auth/login')
  if (!canViewRoom) redirect('/')

  if (isLocalAdmin && !session) {
    return <BaccaratRoomClient username="LocalAdmin" chipBalance={100000} hasVipEmojis />
  }

  const [{ data: profile }, canUseVipEmojis] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, chip_balance')
      .eq('id', session!.user.id)
      .single(),
    hasVipEmojiAccess(supabase, session!.user.id, session!.user.email),
  ])

  const roomProfile = profile as RoomProfile | null

  return (
    <BaccaratRoomClient
      username={roomProfile?.username ?? 'GM'}
      chipBalance={roomProfile?.chip_balance ?? 100000}
      hasVipEmojis={canUseVipEmojis}
    />
  )
}

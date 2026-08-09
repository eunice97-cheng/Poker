import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { hasVipEmojiAccess } from '@/lib/supporter-access'
import { LOCAL_ADMIN_COOKIE, LOCAL_ADMIN_TOKEN, isLocalAdminEnabled } from '@/lib/local-admin'
import { isAdminEmail } from '@/lib/admin'
import { BaccaratRoomClient } from '../../BaccaratRoomClient'

type BaccaratTableProfile = {
  id: string
  username: string | null
  chip_balance: number | null
  avatar: string | null
}

export default async function BaccaratTablePage({ params }: { params: { tableId: string } }) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const isLocalAdmin = isLocalAdminEnabled() && cookies().get(LOCAL_ADMIN_COOKIE)?.value === 'true'

  if (!session && !isLocalAdmin) redirect('/auth/login')

  if (isLocalAdmin && !session) {
    return (
      <BaccaratRoomClient
        tableId={params.tableId}
        token={LOCAL_ADMIN_TOKEN}
        playerId={`local-admin-${params.tableId}`}
        username="LocalAdmin"
        avatar="avatar_m1"
        chipBalance={100000}
        hasVipEmojis
        isAdmin
      />
    )
  }

  const [{ data: profile }, canUseVipEmojis] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, chip_balance, avatar')
      .eq('id', session!.user.id)
      .single(),
    hasVipEmojiAccess(supabase, session!.user.id, session!.user.email),
  ])

  const tableProfile = profile as BaccaratTableProfile | null

  return (
    <BaccaratRoomClient
      tableId={params.tableId}
      token={session!.access_token}
      playerId={tableProfile?.id ?? session!.user.id}
      username={tableProfile?.username ?? 'Player'}
      avatar={tableProfile?.avatar ?? 'avatar_m1'}
      chipBalance={tableProfile?.chip_balance ?? 0}
      hasVipEmojis={canUseVipEmojis}
      isAdmin={isAdminEmail(session!.user.email)}
    />
  )
}

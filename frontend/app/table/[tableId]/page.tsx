import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { hasVipEmojiAccess } from '@/lib/supporter-access'
import { TablePageClient } from './TablePageClient'
import { LOCAL_ADMIN_COOKIE, LOCAL_ADMIN_TOKEN, isLocalAdminEnabled } from '@/lib/local-admin'

export default async function TablePage({ params }: { params: { tableId: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const isLocalAdmin = isLocalAdminEnabled() && cookies().get(LOCAL_ADMIN_COOKIE)?.value === 'true'

  if (!session && !isLocalAdmin) redirect('/auth/login')

  if (isLocalAdmin && !session) {
    return (
      <TablePageClient
        tableId={params.tableId}
        token={LOCAL_ADMIN_TOKEN}
        userId="local-admin"
        chipBalance={100000}
        hasVipEmojis
        isAdmin
      />
    )
  }

  const [{ data: profile }, canUseVipEmojis] = await Promise.all([
    supabase
      .from('profiles')
      .select('chip_balance')
      .eq('id', session!.user.id)
      .single(),
    hasVipEmojiAccess(supabase, session!.user.id, session!.user.email),
  ])

  return (
    <TablePageClient
      tableId={params.tableId}
      token={session!.access_token}
      userId={session!.user.id}
      chipBalance={profile?.chip_balance ?? 0}
      hasVipEmojis={canUseVipEmojis}
      isAdmin={isAdminEmail(session!.user.email)}
    />
  )
}

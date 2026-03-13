import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasVipEmojiAccess } from '@/lib/supporter-access'
import { TablePageClient } from './TablePageClient'

export default async function TablePage({ params }: { params: { tableId: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/auth/login')

  const [{ data: profile }, canUseVipEmojis] = await Promise.all([
    supabase
      .from('profiles')
      .select('chip_balance')
      .eq('id', session.user.id)
      .single(),
    hasVipEmojiAccess(supabase, session.user.id, session.user.email),
  ])

  return (
    <TablePageClient
      tableId={params.tableId}
      token={session.access_token}
      userId={session.user.id}
      chipBalance={profile?.chip_balance ?? 0}
      hasVipEmojis={canUseVipEmojis}
    />
  )
}

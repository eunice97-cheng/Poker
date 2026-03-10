import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TablePageClient } from './TablePageClient'

export default async function TablePage({ params }: { params: { tableId: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('chip_balance')
    .eq('id', session.user.id)
    .single()

  return (
    <TablePageClient
      tableId={params.tableId}
      token={session.access_token}
      userId={session.user.id}
      chipBalance={profile?.chip_balance ?? 0}
    />
  )
}

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { BlackjackTableClient } from './BlackjackTableClient'
import { LOCAL_ADMIN_COOKIE, LOCAL_ADMIN_TOKEN, isLocalAdminEnabled } from '@/lib/local-admin'

export default async function BlackjackTablePage({ params }: { params: { tableId: string } }) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const isLocalAdmin = isLocalAdminEnabled() && cookies().get(LOCAL_ADMIN_COOKIE)?.value === 'true'

  if (!session && !isLocalAdmin) redirect('/auth/login')

  if (isLocalAdmin && !session) {
    return (
      <BlackjackTableClient
        tableId={params.tableId}
        token={LOCAL_ADMIN_TOKEN}
        chipBalance={100000}
      />
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('chip_balance')
    .eq('id', session!.user.id)
    .single()

  return (
    <BlackjackTableClient
      tableId={params.tableId}
      token={session!.access_token}
      chipBalance={profile?.chip_balance ?? 0}
    />
  )
}

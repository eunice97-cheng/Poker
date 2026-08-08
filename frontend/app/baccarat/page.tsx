import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { LOCAL_ADMIN_COOKIE, isLocalAdminEnabled } from '@/lib/local-admin'
import { BaccaratPreviewClient } from './BaccaratPreviewClient'

type PreviewProfile = {
  username: string | null
  chip_balance: number | null
}

export default async function BaccaratPreviewPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const isLocalAdmin = isLocalAdminEnabled() && cookies().get(LOCAL_ADMIN_COOKIE)?.value === 'true'
  const canViewPreview = isLocalAdmin || Boolean(session?.user.email && isAdminEmail(session.user.email))

  if (!session && !isLocalAdmin) redirect('/auth/login')
  if (!canViewPreview) redirect('/')

  if (isLocalAdmin && !session) {
    return <BaccaratPreviewClient username="LocalAdmin" chipBalance={100000} />
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, chip_balance')
    .eq('id', session!.user.id)
    .single()

  const previewProfile = profile as PreviewProfile | null

  return (
    <BaccaratPreviewClient
      username={previewProfile?.username ?? 'GM'}
      chipBalance={previewProfile?.chip_balance ?? 100000}
    />
  )
}

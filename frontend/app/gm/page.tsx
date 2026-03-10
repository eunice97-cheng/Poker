import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { GMClient } from './GMClient'

export default async function GMPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')
  if (!isAdminEmail(user.email)) redirect('/lobby')

  return <GMClient />
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RedeemClient } from './RedeemClient'

export default async function RedeemPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  return (
    <RedeemClient
      userId={session.user.id}
      serverUrl={process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:4000'}
    />
  )
}

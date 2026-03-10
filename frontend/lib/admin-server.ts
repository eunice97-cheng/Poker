import { createClient as createUserClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function getAdminUser() {
  const supabase = createUserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !isAdminEmail(user.email)) {
    return null
  }

  return user
}

export function getServiceSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    return null
  }

  return createServiceClient(supabaseUrl, serviceKey)
}

import type { Request } from 'express'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function requireAuthenticatedUser(request: Request) {
  const authorization = request.headers.authorization
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null

  if (!token) {
    throw new Error('Authentication token required')
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    throw new Error('Invalid or expired token')
  }

  if (!data.user.email_confirmed_at) {
    throw new Error('Email verification required')
  }

  return data.user
}

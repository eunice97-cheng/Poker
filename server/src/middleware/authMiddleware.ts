import { Socket } from 'socket.io'
import { createClient } from '@supabase/supabase-js'
import { isAdminEmail } from '../utils/admin'
import { isLocalAdminToken, LOCAL_ADMIN_ID, LOCAL_ADMIN_USERNAME } from '../utils/localAdmin'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export interface AuthenticatedSocket extends Socket {
  userId: string
  username: string
  avatar: string
  hasVipEmojis: boolean
}

export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
) {
  try {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) {
      return next(new Error('Authentication token required'))
    }

    if (isLocalAdminToken(token)) {
      ;(socket as AuthenticatedSocket).userId = LOCAL_ADMIN_ID
      ;(socket as AuthenticatedSocket).username = LOCAL_ADMIN_USERNAME
      ;(socket as AuthenticatedSocket).avatar = 'avatar_m1'
      ;(socket as AuthenticatedSocket).hasVipEmojis = true
      next()
      return
    }

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      return next(new Error('Invalid or expired token'))
    }
    if (!data.user.email_confirmed_at) {
      return next(new Error('Email verification required'))
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, avatar')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      return next(new Error('Profile not found'))
    }

    let hasVipEmojis = isAdminEmail(data.user.email)

    if (!hasVipEmojis) {
      const { data: vipUnlock, error: vipUnlockError } = await supabase
        .from('transactions')
        .select('id')
        .eq('player_id', data.user.id)
        .eq('type', 'kofi_redeem')
        .limit(1)
        .maybeSingle()

      if (vipUnlockError) {
        return next(new Error('Could not verify supporter access'))
      }

      hasVipEmojis = Boolean(vipUnlock)
    }

    ;(socket as AuthenticatedSocket).userId = data.user.id
    ;(socket as AuthenticatedSocket).username = profile.username
    ;(socket as AuthenticatedSocket).avatar = profile.avatar ?? 'avatar_m1'
    ;(socket as AuthenticatedSocket).hasVipEmojis = hasVipEmojis
    next()
  } catch {
    next(new Error('Authentication failed'))
  }
}

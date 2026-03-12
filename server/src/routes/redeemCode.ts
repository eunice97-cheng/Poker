import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuthenticatedUser } from '../utils/auth'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// POST /api/redeem-code
// Body: { code: string }
router.post('/', async (req, res) => {
  if (process.env.KOFI_ENABLED !== 'true') {
    return res.status(403).json({ error: 'Chip shop is not available yet.' })
  }

  const { code } = req.body
  if (!code) {
    return res.status(400).json({ error: 'Missing redemption code.' })
  }

  const normalised = String(code).toUpperCase().trim()

  try {
    const user = await requireAuthenticatedUser(req)

    const { data, error } = await supabase.rpc('redeem_chip_code', {
      p_code: normalised,
      p_player_id: user.id,
    })

    if (error) {
      const message = error.message || 'Could not redeem this code.'
      const status = /Invalid redemption code|already been used|Player not found/.test(message) ? 400 : 500
      return res.status(status).json({ error: message })
    }

    const result = Array.isArray(data) ? data[0] : data
    if (!result) {
      return res.status(500).json({ error: 'Could not redeem this code.' })
    }

    console.log(`[Redeem] ${user.id} redeemed ${normalised} for ${result.chips} chips`)
    return res.json({ chips: result.chips, newBalance: result.new_balance })
  } catch (err) {
    console.error('[Redeem] Error:', err)
    const message = err instanceof Error ? err.message : 'Server error. Please try again.'
    const status = /Authentication token required|Invalid or expired token|Email verification required/.test(message)
      ? 401
      : 500
    return res.status(status).json({ error: message })
  }
})

export default router

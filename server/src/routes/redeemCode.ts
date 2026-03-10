import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// POST /api/redeem-code
// Body: { code: string, playerId: string }
// The frontend sends the authenticated player's ID (validated against Supabase JWT on their side)
router.post('/', async (req, res) => {
  if (process.env.KOFI_ENABLED !== 'true') {
    return res.status(403).json({ error: 'Chip shop is not available yet.' })
  }

  const { code, playerId } = req.body
  if (!code || !playerId) {
    return res.status(400).json({ error: 'Missing code or playerId' })
  }

  const normalised = String(code).toUpperCase().trim()

  try {
    // Find code
    const { data: chipCode, error } = await supabase
      .from('chip_codes')
      .select('*')
      .eq('code', normalised)
      .single()

    if (error || !chipCode) {
      return res.status(400).json({ error: 'Invalid redemption code.' })
    }
    if (chipCode.is_redeemed) {
      return res.status(400).json({ error: 'This code has already been used.' })
    }

    // Mark as redeemed (atomic-ish: unique constraint on code prevents double-spend race)
    const { error: updateError } = await supabase
      .from('chip_codes')
      .update({
        is_redeemed: true,
        redeemed_by: playerId,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', chipCode.id)
      .eq('is_redeemed', false)  // optimistic lock

    if (updateError) {
      return res.status(400).json({ error: 'Code already redeemed.' })
    }

    // Add chips directly to profile balance
    const { data: profile } = await supabase
      .from('profiles')
      .select('chip_balance')
      .eq('id', playerId)
      .single()

    if (!profile) {
      return res.status(404).json({ error: 'Player not found.' })
    }

    const newBalance = profile.chip_balance + chipCode.chips_amount

    await supabase
      .from('profiles')
      .update({ chip_balance: newBalance })
      .eq('id', playerId)

    // Audit trail
    await supabase.from('transactions').insert({
      player_id: playerId,
      amount: chipCode.chips_amount,
      type: 'kofi_redeem',
      reference: normalised,
    })

    console.log(`[Redeem] ${playerId} redeemed ${normalised} for ${chipCode.chips_amount} chips`)
    res.json({ chips: chipCode.chips_amount, newBalance })
  } catch (err) {
    console.error('[Redeem] Error:', err)
    res.status(500).json({ error: 'Server error. Please try again.' })
  }
})

export default router

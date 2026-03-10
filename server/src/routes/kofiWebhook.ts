import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { sendChipCodeEmail } from '../services/emailService'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Chip packages: USD amount → chips awarded
// Edit these to match whatever you list on Ko-fi
const CHIP_PACKAGES: { usd: number; chips: number; label: string }[] = [
  { usd: 5,  chips: 5_000,  label: '5,000 chips' },
  { usd: 10, chips: 12_000, label: '12,000 chips' },
  { usd: 20, chips: 27_000, label: '27,000 chips' },
  { usd: 50, chips: 75_000, label: '75,000 chips' },
]

function generateCode(): string {
  const part = () => Math.random().toString(36).substring(2, 6).toUpperCase()
  return `CHIP-${part()}-${part()}-${part()}`
}

// POST /webhook/kofi
// Ko-fi sends form-encoded body: { data: JSON string }
router.post('/', async (req, res) => {
  // Feature gate — flip KOFI_ENABLED=true when you're ready to sell
  if (process.env.KOFI_ENABLED !== 'true') {
    return res.sendStatus(200) // acknowledge silently
  }

  try {
    const raw = req.body?.data
    if (!raw) return res.sendStatus(400)

    const data = JSON.parse(raw)

    // Verify the token matches what you set in Ko-fi settings
    if (data.verification_token !== process.env.KOFI_VERIFICATION_TOKEN) {
      console.warn('[Ko-fi] Invalid verification token')
      return res.sendStatus(401)
    }

    // Only handle one-time donations / shop purchases (skip subscriptions if you want)
    const amount = parseFloat(data.amount ?? '0')
    const pkg = CHIP_PACKAGES.find((p) => Math.abs(p.usd - amount) < 0.50)

    if (!pkg) {
      console.log(`[Ko-fi] No package matched for $${amount} — ignoring`)
      return res.sendStatus(200)
    }

    const code = generateCode()

    await supabase.from('chip_codes').insert({
      code,
      chips_amount: pkg.chips,
      usd_amount: amount,
      buyer_email: data.email ?? null,
    })

    // Email the code to the buyer
    if (data.email) {
      await sendChipCodeEmail({
        to: data.email,
        buyerName: data.from_name ?? 'there',
        code,
        chips: pkg.chips,
        label: pkg.label,
      })
    }

    console.log(`[Ko-fi] Code ${code} issued for $${amount} (${pkg.chips} chips) to ${data.email}`)
    res.sendStatus(200)
  } catch (err) {
    console.error('[Ko-fi] Webhook error:', err)
    res.sendStatus(500)
  }
})

export default router

import { randomBytes } from 'crypto'
import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { sendChipCodeEmail } from '../services/emailService'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

type ChipPackage = {
  sourceType: 'donation' | 'membership'
  usd: number
  chips: number
  label: string
}

type KofiPayload = {
  amount?: string | number
  email?: string
  from_name?: string
  is_subscription_payment?: boolean
  kofi_transaction_id?: string
  message_id?: string
  shop_transaction_id?: string
  timestamp?: string
  type?: string
  verification_token?: string
}

// Chip packages: USD amount -> chips awarded.
// Keep this table aligned with the public Ko-fi support tiers.
const CHIP_PACKAGES: ChipPackage[] = [
  { sourceType: 'donation', usd: 5, chips: 5_000, label: '5,000 chips' },
  { sourceType: 'donation', usd: 10, chips: 12_000, label: '12,000 chips' },
  { sourceType: 'donation', usd: 15, chips: 20_000, label: '20,000 chips' },
  { sourceType: 'donation', usd: 20, chips: 27_000, label: '27,000 chips' },
  { sourceType: 'donation', usd: 25, chips: 35_000, label: '35,000 chips' },
  { sourceType: 'membership', usd: 5, chips: 6_000, label: '6,000 monthly chips' },
  { sourceType: 'membership', usd: 10, chips: 15_000, label: '15,000 monthly chips' },
  { sourceType: 'membership', usd: 25, chips: 45_000, label: '45,000 monthly chips' },
]

function generateCode(): string {
  const part = () => randomBytes(3).toString('base64url').slice(0, 4).toUpperCase()
  return `CHIP-${part()}-${part()}-${part()}`
}

function getEventId(data: KofiPayload) {
  const candidates = [
    data.message_id,
    data.kofi_transaction_id,
    data.shop_transaction_id,
    data.timestamp,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  return null
}

function getSourceType(data: KofiPayload) {
  const type = typeof data.type === 'string' ? data.type.toLowerCase() : ''
  if (data.is_subscription_payment || type.includes('subscription')) {
    return 'membership'
  }

  return 'donation'
}

// POST /webhook/kofi
// Ko-fi sends form-encoded body: { data: JSON string }
router.post('/', async (req, res) => {
  if (process.env.KOFI_ENABLED !== 'true') {
    return res.sendStatus(200)
  }

  try {
    const raw = req.body?.data
    if (!raw) return res.sendStatus(400)

    const data = JSON.parse(raw) as KofiPayload

    if (data.verification_token !== process.env.KOFI_VERIFICATION_TOKEN) {
      console.warn('[Ko-fi] Invalid verification token')
      return res.sendStatus(401)
    }

    const eventId = getEventId(data)
    if (!eventId) {
      console.warn('[Ko-fi] Missing upstream event id')
      return res.sendStatus(400)
    }

    const sourceType = getSourceType(data)
    const amount = parseFloat(String(data.amount ?? '0'))
    const pkg = CHIP_PACKAGES.find(
      (entry) => entry.sourceType === sourceType && Math.abs(entry.usd - amount) < 0.5
    )
    if (!pkg) {
      console.log(`[Ko-fi] No ${sourceType} package matched for $${amount} - ignoring`)
      return res.sendStatus(200)
    }

    const { data: existingCode, error: existingError } = await supabase
      .from('chip_codes')
      .select('id')
      .eq('external_event_id', eventId)
      .maybeSingle()

    if (existingError) {
      throw existingError
    }

    if (existingCode) {
      console.log(`[Ko-fi] Duplicate event ${eventId} ignored`)
      return res.sendStatus(200)
    }

    const code = generateCode()
    const { error: insertError } = await supabase.from('chip_codes').insert({
      code,
      chips_amount: pkg.chips,
      usd_amount: amount,
      buyer_email: data.email ?? null,
      provider: 'kofi',
      source_type: sourceType,
      external_payment_id: data.kofi_transaction_id ?? data.shop_transaction_id ?? null,
      external_event_id: eventId,
    })

    if (insertError) {
      if (insertError.code === '23505') {
        console.log(`[Ko-fi] Duplicate event ${eventId} ignored`)
        return res.sendStatus(200)
      }

      throw insertError
    }

    if (data.email) {
      await sendChipCodeEmail({
        to: data.email,
        buyerName: data.from_name ?? 'there',
        code,
        chips: pkg.chips,
        label: pkg.label,
      })
    }

    console.log(
      `[Ko-fi] Code ${code} issued for ${sourceType} event ${eventId} ($${amount}, ${pkg.chips} chips) to ${data.email}`
    )
    return res.sendStatus(200)
  } catch (err) {
    console.error('[Ko-fi] Webhook error:', err)
    return res.sendStatus(500)
  }
})

export default router

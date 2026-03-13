// Email service using Resend.
// Set RESEND_API_KEY and EMAIL_FROM to enable outgoing email.

interface ChipCodeEmailParams {
  to: string
  buyerName: string
  code: string
  chips: number
  label: string
}

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendChipCodeEmail(params: ChipCodeEmailParams) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not set - skipping email send')
    console.log(`[Email] Would have sent code ${params.code} to ${params.to}`)
    return
  }

  const siteUrl = getSiteUrl()
  const redeemUrl = `${siteUrl}/redeem`
  const logoUrl = `${siteUrl}/icon.svg`
  const safeBuyerName = escapeHtml(params.buyerName)
  const safeCode = escapeHtml(params.code)
  const safeLabel = escapeHtml(params.label)

  const html = `
    <div style="margin:0;background:#140905;padding:24px 12px;font-family:Georgia,'Times New Roman',serif;color:#f8ead2">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(243,210,162,0.24);border-radius:28px;overflow:hidden;background:linear-gradient(180deg,#1a0d08 0%,#100806 100%);box-shadow:0 30px 80px rgba(0,0,0,0.35)">
        <div style="padding:24px 28px 18px;background:radial-gradient(circle at top,rgba(243,180,91,0.18),transparent 54%)">
          <div style="display:flex;align-items:center;gap:14px">
            <img src="${logoUrl}" alt="ASL Basement Poker" width="56" height="56" style="display:block;border-radius:14px;background:#120907" />
            <div>
              <div style="font-size:28px;line-height:1.05;font-weight:700;color:#fff3e2">ASL Basement Poker</div>
              <div style="margin-top:6px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.34em;text-transform:uppercase;color:rgba(243,210,162,0.66)">Drinks first. Cards after.</div>
            </div>
          </div>
        </div>

        <div style="padding:0 28px 30px">
          <div style="border:1px solid rgba(243,210,162,0.16);border-radius:22px;padding:24px;background:linear-gradient(180deg,rgba(24,13,9,0.88),rgba(18,9,7,0.78))">
            <div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#f3d2a2">Support confirmed</div>
            <h1 style="margin:14px 0 10px;font-size:34px;line-height:1.06;color:#fff3e2">Your redeem code is ready.</h1>
            <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:rgba(255,232,202,0.78)">
              Thanks for the support, ${safeBuyerName}. Your <strong style="color:#fff3e2">${safeLabel}</strong> reward has been prepared for the poker room.
            </p>

            <div style="margin:22px 0;border:1px solid rgba(243,210,162,0.22);border-radius:20px;background:#0f172a;padding:18px 16px;text-align:center">
              <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(243,210,162,0.66)">Redeem code</div>
              <div style="margin-top:12px;font-family:'Courier New',monospace;font-size:28px;font-weight:700;letter-spacing:0.18em;color:#facc15">${safeCode}</div>
              <div style="margin-top:14px;font-family:Arial,sans-serif;font-size:14px;color:rgba(255,232,202,0.76)">${params.chips.toLocaleString()} chips will be credited when redeemed.</div>
            </div>

            <a href="${redeemUrl}" style="display:block;margin:0 0 18px;border-radius:16px;background:linear-gradient(135deg,#f3c667,#e39a2f);padding:15px 18px;text-align:center;font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#1d1208;text-decoration:none">
              Redeem Your Code
            </a>

            <div style="border-top:1px solid rgba(243,210,162,0.12);padding-top:18px">
              <div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#f3d2a2">How it works</div>
              <ol style="margin:12px 0 0;padding-left:18px;font-family:Arial,sans-serif;font-size:14px;line-height:1.9;color:rgba(255,232,202,0.8)">
                <li>Sign in to ASL Basement Poker.</li>
                <li>Open the redeem page.</li>
                <li>Paste the code shown above.</li>
                <li>Your chips will be added instantly.</li>
              </ol>
            </div>
          </div>

          <p style="margin:18px 4px 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.7;color:rgba(255,232,202,0.46)">
            Each code can only be redeemed once. If anything looks wrong, reply to this email and include the code above.
          </p>
        </div>
      </div>
    </div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'chips@yourdomain.com',
        to: params.to,
        subject: `ASL Basement Poker: your ${params.label} redeem code`,
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[Email] Resend error:', body)
    } else {
      console.log(`[Email] Sent chip code to ${params.to}`)
    }
  } catch (err) {
    console.error('[Email] Failed to send email:', err)
  }
}

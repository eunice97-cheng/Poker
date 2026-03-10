// Email service using Resend (https://resend.com — free tier: 3,000 emails/month)
// Set RESEND_API_KEY in your .env to enable email sending.

interface ChipCodeEmailParams {
  to: string
  buyerName: string
  code: string
  chips: number
  label: string
}

export async function sendChipCodeEmail(params: ChipCodeEmailParams) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not set — skipping email send')
    console.log(`[Email] Would have sent code ${params.code} to ${params.to}`)
    return
  }

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111;color:#fff;padding:32px;border-radius:16px">
      <h2 style="color:#facc15;margin-bottom:8px">Your chip code is ready! 🎰</h2>
      <p style="color:#aaa">Hey ${params.buyerName}, thank you for your support!</p>
      <p style="color:#ddd;margin-bottom:24px">Here is your <strong>${params.label}</strong> redemption code:</p>
      <div style="background:#1f2937;border:2px solid #facc15;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
        <span style="font-family:monospace;font-size:24px;font-weight:bold;letter-spacing:4px;color:#facc15">${params.code}</span>
      </div>
      <p style="color:#aaa;font-size:14px">To redeem:</p>
      <ol style="color:#ddd;font-size:14px;line-height:2">
        <li>Log in to the poker site</li>
        <li>Go to <strong>Profile → Redeem Code</strong></li>
        <li>Enter the code above</li>
        <li>${params.chips.toLocaleString()} chips will be added instantly</li>
      </ol>
      <p style="color:#666;font-size:12px;margin-top:24px">Each code can only be used once. If you have issues, reply to this email.</p>
    </div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'chips@yourdomain.com',
        to: params.to,
        subject: `Your ${params.label} chip code 🎰`,
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

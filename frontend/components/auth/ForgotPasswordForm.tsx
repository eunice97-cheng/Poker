'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { getClientSiteUrl } from '@/lib/site-url'

export function ForgotPasswordForm() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${getClientSiteUrl()}/auth/reset-password`,
      })

      if (error) throw error
      setSuccess(true)
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Unable to send reset email.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-gray-400">Email</label>
        <input
          type="email"
          required
          className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-white outline-none transition-colors focus:border-yellow-500"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      {success && (
        <div className="rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          Check your email for the password reset link. Open it in the same Poker or Blackjack site you requested it from.
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
        Send Reset Link
      </Button>

      <p className="text-center text-sm text-gray-500">
        Remembered it?{' '}
        <Link href="/auth/login" className="text-yellow-400 hover:text-yellow-300">
          Sign In
        </Link>
      </p>
    </form>
  )
}

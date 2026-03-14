'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ensureProfileExists } from '@/lib/profile'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { getClientSiteUrl } from '@/lib/site-url'

const REMEMBERED_EMAIL_KEY = 'poker_remembered_email'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberEmail, setRememberEmail] = useState(false)
  const [error, setError] = useState('')
  const [resendMessage, setResendMessage] = useState('')
  const [resendError, setResendError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [showResendConfirmation, setShowResendConfirmation] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY)
    if (saved) {
      setEmail(saved)
      setRememberEmail(true)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResendMessage('')
    setResendError('')
    setShowResendConfirmation(false)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw userError ?? new Error('Unable to load your account')
      }

      if (!user.email_confirmed_at) {
        await supabase.auth.signOut()
        throw new Error('Please verify your email before signing in.')
      }

      const { error: profileError } = await ensureProfileExists(supabase, user)
      if (profileError) throw profileError

      if (rememberEmail) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email)
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY)
      }
      router.push('/lobby')
    } catch (err: unknown) {
      const nextError = getAuthErrorMessage(err, 'Login failed')
      setError(nextError)
      setShowResendConfirmation(nextError === 'Please verify your email before signing in.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    setResendMessage('')
    setResendError('')

    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setResendError('Enter your email address first.')
      return
    }

    setResendLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${getClientSiteUrl()}/auth/callback`,
        },
      })

      if (error) throw error

      setResendMessage(`We sent a new confirmation email to ${normalizedEmail}.`)
    } catch (err: unknown) {
      setResendError(getAuthErrorMessage(err, 'Unable to resend confirmation email.'))
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-gray-400 text-sm mb-1">Email</label>
        <input
          type="email"
          required
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white outline-none focus:border-yellow-500 transition-colors"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setResendMessage('')
            setResendError('')
          }}
        />
      </div>

      <div>
        <label className="block text-gray-400 text-sm mb-1">Password</label>
        <input
          type="password"
          required
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white outline-none focus:border-yellow-500 transition-colors"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={rememberEmail}
          onChange={(e) => setRememberEmail(e.target.checked)}
          className="w-4 h-4 accent-yellow-400"
        />
        <span className="text-gray-400 text-sm">Remember my email</span>
      </label>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {showResendConfirmation && (
        <div className="space-y-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <p className="text-sm text-yellow-100">
            Your account is registered, but your email still needs confirmation. We can send you a fresh
            verification link.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={resendLoading}
            className="w-full border-yellow-500/40 text-yellow-200 hover:bg-yellow-500/10"
            onClick={handleResendConfirmation}
          >
            Resend Confirmation Email
          </Button>
          {resendMessage && <p className="text-sm text-green-400">{resendMessage}</p>}
          {resendError && <p className="text-sm text-red-400">{resendError}</p>}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
        Sign In
      </Button>

      <p className="text-center text-gray-500 text-sm">
        No account?{' '}
        <Link href="/auth/register" className="text-yellow-400 hover:text-yellow-300">
          Register
        </Link>
      </p>
    </form>
  )
}

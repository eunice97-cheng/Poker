'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { ensureProfileExists } from '@/lib/profile'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { getClientSiteUrl } from '@/lib/site-url'

const REMEMBERED_EMAIL_KEY = 'poker_remembered_email'
const LOGIN_TIMEOUT_MS = 15000

function withTimeout<T>(promise: Promise<T>, timeoutMessage: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, LOGIN_TIMEOUT_MS)

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout))
  })
}

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
      const normalizedEmail = email.trim()
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email: normalizedEmail, password }),
        'Sign in is taking too long. Check your internet/Supabase connection and try again.'
      )
      if (error) throw error

      const {
        data: { user },
        error: userError,
      } = await withTimeout(
        supabase.auth.getUser(),
        'Signed in, but loading your account took too long. Try refreshing the page.'
      )

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
        localStorage.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail)
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY)
      }
      window.location.assign('/')
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
    <form onSubmit={handleSubmit} className="auth-login-form space-y-4">
      <div className="auth-login-form__field">
        <label className="auth-login-form__label mb-1 block text-sm text-gray-400">Email</label>
        <input
          type="email"
          required
          className="auth-login-form__input w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-white outline-none transition-colors focus:border-yellow-500"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setResendMessage('')
            setResendError('')
          }}
        />
      </div>

      <div className="auth-login-form__field">
        <label className="auth-login-form__label mb-1 block text-sm text-gray-400">Password</label>
        <input
          type="password"
          required
          className="auth-login-form__input w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-white outline-none transition-colors focus:border-yellow-500"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <label className="auth-login-form__remember flex cursor-pointer select-none items-center gap-2">
        <input
          type="checkbox"
          checked={rememberEmail}
          onChange={(e) => setRememberEmail(e.target.checked)}
          className="h-4 w-4 accent-yellow-400"
        />
        <span className="text-sm text-gray-400">Remember my email</span>
      </label>

      {error && <p className="auth-login-form__message text-sm text-red-400">{error}</p>}
      {showResendConfirmation && (
        <div className="auth-login-form__resend space-y-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
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
          {resendMessage && <p className="auth-login-form__message text-sm text-green-400">{resendMessage}</p>}
          {resendError && <p className="auth-login-form__message text-sm text-red-400">{resendError}</p>}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" loading={loading} className="auth-login-form__submit w-full">
        Sign In
      </Button>

      <p className="auth-login-form__links text-center text-sm text-gray-500">
        No account?{' '}
        <Link href="/auth/register" className="text-yellow-400 hover:text-yellow-300">
          Register
        </Link>{' '}
        <span className="text-gray-700">|</span>{' '}
        <Link href="/auth/forgot-password" className="text-yellow-400 hover:text-yellow-300">
          Forgot password?
        </Link>
      </p>
    </form>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorMessage } from '@/lib/auth-errors'

const RECOVERY_SESSION_KEY = 'poker_password_recovery_ready'
const RECOVERY_SESSION_MAX_AGE_MS = 30 * 60 * 1000

function readRecoverySessionFlag() {
  if (typeof window === 'undefined') return false

  const storedAt = Number(sessionStorage.getItem(RECOVERY_SESSION_KEY))
  if (!Number.isFinite(storedAt) || Date.now() - storedAt > RECOVERY_SESSION_MAX_AGE_MS) {
    sessionStorage.removeItem(RECOVERY_SESSION_KEY)
    return false
  }

  return true
}

function writeRecoverySessionFlag() {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(RECOVERY_SESSION_KEY, String(Date.now()))
}

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    const prepareRecoverySession = async () => {
      setCheckingSession(true)
      setError('')

      try {
        let recoveryReady = readRecoverySessionFlag()
        const recoveryMarker = searchParams.get('recovery') === '1'

        if (recoveryMarker && typeof window !== 'undefined') {
          recoveryReady = true
          writeRecoverySessionFlag()
          router.replace('/auth/reset-password')
        }

        if (typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
          const hashError = hashParams.get('error_description') || hashParams.get('error')
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (hashError) {
            throw new Error(hashError)
          }

          if (accessToken && refreshToken) {
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })

            if (setSessionError) throw setSessionError
            recoveryReady = true
            writeRecoverySessionFlag()
            window.history.replaceState(null, '', '/auth/reset-password')
          }
        }

        const code = searchParams.get('code')

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
          recoveryReady = true
          writeRecoverySessionFlag()
          router.replace('/auth/reset-password')
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError
        if (!cancelled) setHasRecoverySession(Boolean(session) && recoveryReady)
      } catch (err) {
        if (!cancelled) {
          setHasRecoverySession(false)
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem(RECOVERY_SESSION_KEY)
          }
          setError(getAuthErrorMessage(err, 'The reset link is invalid or expired.'))
        }
      } finally {
        if (!cancelled) setCheckingSession(false)
      }
    }

    void prepareRecoverySession()

    return () => {
      cancelled = true
    }
  }, [router, searchParams, supabase])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(RECOVERY_SESSION_KEY)
      }
      await supabase.auth.signOut()
      setSuccess(true)
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Unable to update password.'))
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">
        Preparing password reset...
      </div>
    )
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          Password updated. You can sign in with the new password now.
        </div>
        <Link href="/auth/login" className="inline-flex rounded-lg bg-yellow-500 px-5 py-3 font-bold text-black hover:bg-yellow-400">
          Back to Sign In
        </Link>
      </div>
    )
  }

  if (!hasRecoverySession) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error || 'The reset link is invalid or expired.'}
        </div>
        <Link href="/auth/forgot-password" className="text-yellow-400 hover:text-yellow-300">
          Request a new reset link
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-gray-400">New Password</label>
        <input
          type="password"
          required
          minLength={6}
          className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-white outline-none transition-colors focus:border-yellow-500"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-gray-400">Confirm Password</label>
        <input
          type="password"
          required
          minLength={6}
          className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-white outline-none transition-colors focus:border-yellow-500"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
        Update Password
      </Button>
    </form>
  )
}

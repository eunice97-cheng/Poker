'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const REMEMBERED_EMAIL_KEY = 'poker_remembered_email'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberEmail, setRememberEmail] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (rememberEmail) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email)
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY)
      }
      router.push('/lobby')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
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
          onChange={(e) => setEmail(e.target.value)}
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

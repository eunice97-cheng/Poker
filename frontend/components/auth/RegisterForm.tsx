'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function RegisterForm() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (username.length < 3) {
      return setError('Username must be at least 3 characters')
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return setError('Username can only contain letters, numbers, and underscores')
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
        },
      })
      if (error) throw error
      router.push('/lobby')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-gray-400 text-sm mb-1">Player Name <span className="text-gray-600">(shown at the table)</span></label>
        <input
          type="text"
          required
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white outline-none focus:border-yellow-500 transition-colors"
          placeholder="PokerPro99"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
          maxLength={20}
        />
      </div>

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
          minLength={6}
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="bg-gray-800/50 rounded-lg px-4 py-3 text-sm text-gray-500">
        You will start with <span className="text-yellow-400 font-bold">10,000 chips</span> free!
      </div>

      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
        Create Account
      </Button>

      <p className="text-center text-gray-500 text-sm">
        Have an account?{' '}
        <Link href="/auth/login" className="text-yellow-400 hover:text-yellow-300">
          Sign In
        </Link>
      </p>
    </form>
  )
}

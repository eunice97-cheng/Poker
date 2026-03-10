'use client'

import { useState } from 'react'
import Link from 'next/link'

interface GrantResponse {
  username: string
  amount: number
  balance: number
  note: string
}

export function GMClient() {
  const [identifier, setIdentifier] = useState('')
  const [amount, setAmount] = useState('10000')
  const [note, setNote] = useState('GM beta compensation')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<GrantResponse | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/grant-chips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          amount: Number(amount),
          note: note.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Grant failed')
      }

      setSuccess(data)
      setIdentifier('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Grant failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">GM Chips</h1>
            <p className="text-sm text-gray-400">Grant chips to a player by exact username or player UUID.</p>
          </div>
          <Link href="/lobby" className="text-sm text-gray-500 hover:text-white">
            Back
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">Player</label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Exact username or UUID"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">Amount</label>
            <input
              type="number"
              required
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why you granted these chips"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none focus:border-yellow-500"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {success && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm">
              <div className="font-bold text-green-300">Grant successful</div>
              <div className="mt-1 text-gray-200">
                {success.username} received {success.amount.toLocaleString()} chips.
              </div>
              <div className="text-gray-400">New balance: {success.balance.toLocaleString()}</div>
              {success.note && <div className="text-gray-500">Note: {success.note}</div>}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-yellow-500 py-3 font-bold text-black transition-colors hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading ? 'Granting…' : 'Grant Chips'}
          </button>
        </form>
      </div>
    </div>
  )
}

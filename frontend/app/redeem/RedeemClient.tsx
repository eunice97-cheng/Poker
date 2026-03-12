'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface RedeemClientProps {
  serverUrl: string
}

export function RedeemClient({ serverUrl }: RedeemClientProps) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [chipsAdded, setChipsAdded] = useState(0)
  const supabase = createClient()

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setStatus('loading')
    setMessage('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setStatus('error')
        setMessage('Your session has expired. Please sign in again.')
        return
      }

      const res = await fetch(`${serverUrl}/api/redeem-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json()

      if (data.error) {
        setStatus('error')
        setMessage(data.error)
      } else {
        setStatus('success')
        setChipsAdded(data.chips)
        setCode('')
      }
    } catch {
      setStatus('error')
      setMessage('Could not connect to server. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎰</div>
          <h1 className="text-white text-2xl font-bold">Redeem Chip Code</h1>
          <p className="text-gray-400 text-sm mt-1">Enter the code from your chip support email</p>
        </div>

        {status === 'success' ? (
          <div className="text-center">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-green-400 text-lg font-bold mb-1">
              +{chipsAdded.toLocaleString()} chips added!
            </p>
            <p className="text-gray-400 text-sm mb-6">Your balance has been updated.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setStatus('idle')
                  setMessage('')
                }}
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:text-white text-sm transition-colors"
              >
                Redeem another
              </button>
              <Link
                href="/lobby"
                className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition-colors"
              >
                Back to Lobby
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRedeem}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CHIP-XXXX-XXXX-XXXX"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 font-mono text-center text-lg focus:outline-none focus:border-yellow-500 mb-3"
              maxLength={20}
              spellCheck={false}
            />

            {status === 'error' && (
              <p className="text-red-400 text-sm text-center mb-3">{message}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading' || !code.trim()}
              className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold text-base transition-colors"
            >
              {status === 'loading' ? 'Redeeming...' : 'Redeem'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link href="/lobby" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
            ← Back to Lobby
          </Link>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface GrantResponse {
  username: string
  amount: number
  balance: number
  note: string
}

interface AdminTable {
  id: string
  name: string
  status: string
  player_count: number
  small_blind: number
  big_blind: number
  created_at: string
}

export function GMClient() {
  const [identifier, setIdentifier] = useState('')
  const [amount, setAmount] = useState('10000')
  const [note, setNote] = useState('GM beta compensation')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<GrantResponse | null>(null)
  const [tables, setTables] = useState<AdminTable[]>([])
  const [tablesLoading, setTablesLoading] = useState(true)
  const [tableError, setTableError] = useState('')
  const [closingTableId, setClosingTableId] = useState('')

  const loadTables = async () => {
    setTablesLoading(true)
    setTableError('')

    try {
      const res = await fetch('/api/admin/tables')
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to load tables')
      }
      setTables(data.tables ?? [])
    } catch (err: unknown) {
      setTableError(err instanceof Error ? err.message : 'Failed to load tables')
    } finally {
      setTablesLoading(false)
    }
  }

  useEffect(() => {
    loadTables().catch(() => undefined)
  }, [])

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

  const handleCloseTable = async (tableId: string) => {
    setClosingTableId(tableId)
    setTableError('')

    try {
      const res = await fetch('/api/admin/tables', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to close table')
      }
      setTables((prev) => prev.filter((table) => table.id !== tableId))
    } catch (err: unknown) {
      setTableError(err instanceof Error ? err.message : 'Failed to close table')
    } finally {
      setClosingTableId('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-stretch gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="w-full max-w-none rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl sm:p-8 xl:max-w-lg">
          <div className="mb-6 flex items-center justify-between gap-3">
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

        <div className="w-full rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white">GM Tables</h2>
              <p className="text-sm text-gray-400">Close a stuck or unwanted table from the beta lobby.</p>
            </div>
            <button
              onClick={() => loadTables()}
              className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white hover:text-white"
            >
              Refresh
            </button>
          </div>

          {tableError && <p className="mb-4 text-sm text-red-400">{tableError}</p>}

          <div className="space-y-3">
            {tablesLoading ? (
              <p className="text-sm text-gray-500">Loading tables…</p>
            ) : tables.length === 0 ? (
              <p className="text-sm text-gray-500">No tables found.</p>
            ) : (
              tables.map((table) => (
                <div key={table.id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-bold text-white">{table.name}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {table.small_blind}/{table.big_blind} • {table.player_count} players • {table.status}
                      </div>
                      <div className="mt-1 text-[11px] text-gray-600">{table.id}</div>
                    </div>
                    <button
                      onClick={() => handleCloseTable(table.id)}
                      disabled={closingTableId === table.id}
                      className="rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-300 transition-colors hover:border-red-500 hover:text-white disabled:opacity-50 sm:self-start"
                    >
                      {closingTableId === table.id ? 'Closing…' : 'Close Table'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

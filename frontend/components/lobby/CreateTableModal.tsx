'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface CreateTableModalProps {
  open: boolean
  onClose: () => void
  chipBalance: number
  onCreate: (params: {
    name: string
    maxPlayers: number
    smallBlind: number
    bigBlind: number
    minBuyin: number
    maxBuyin: number
    buyIn: number
  }) => void
}

export function CreateTableModal({ open, onClose, chipBalance, onCreate }: CreateTableModalProps) {
  const [name, setName] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(6)
  const [bigBlind, setBigBlind] = useState(50)
  const [buyIn, setBuyIn] = useState(1000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const smallBlind = bigBlind / 2
  const minBuyin = bigBlind * 20
  const maxBuyin = bigBlind * 100
  const actualBuyIn = Math.max(minBuyin, Math.min(maxBuyin, buyIn))
  const canAfford = chipBalance >= actualBuyIn

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canAfford) return
    setLoading(true)
    setError('')
    try {
      await onCreate({
        name: name || 'My Table',
        maxPlayers,
        smallBlind,
        bigBlind,
        minBuyin,
        maxBuyin,
        buyIn: actualBuyIn,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create table')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Table">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-gray-400">Table Name</label>
          <input
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none focus:border-yellow-500"
            placeholder="My Table"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm text-gray-400">Max Players</label>
            <select
              className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n} players</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">Big Blind</label>
            <select
              className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none"
              value={bigBlind}
              onChange={(e) => setBigBlind(Number(e.target.value))}
            >
              {[10, 20, 50, 100, 200, 500].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">
            Your Buy-in ({minBuyin.toLocaleString()}-{maxBuyin.toLocaleString()})
          </label>
          <input
            type="number"
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none focus:border-yellow-500"
            value={buyIn}
            onChange={(e) => setBuyIn(Number(e.target.value))}
            min={minBuyin}
            max={maxBuyin}
          />
          {!canAfford && (
            <p className="mt-1 text-xs text-red-400">Insufficient chips (balance: {chipBalance.toLocaleString()})</p>
          )}
        </div>

        <div className="space-y-1 rounded-lg bg-gray-800/50 p-3 text-sm text-gray-400">
          <div className="flex justify-between">
            <span>Blinds</span>
            <span className="text-white">{smallBlind}/{bigBlind}</span>
          </div>
          <div className="flex justify-between">
            <span>Buy-in range</span>
            <span className="text-white">{minBuyin.toLocaleString()}-{maxBuyin.toLocaleString()}</span>
          </div>
        </div>

        <p className="rounded-lg border border-[#f3d2a2]/10 bg-[#f1b45b]/6 px-3 py-2 text-xs leading-5 text-[#f7dfba]/78">
          A house player may join if the room is empty.
        </p>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" className="flex-1" loading={loading} disabled={!canAfford}>
            Create & Sit Down
          </Button>
        </div>
      </form>
    </Modal>
  )
}

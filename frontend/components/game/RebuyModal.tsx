'use client'

import { useState, useEffect } from 'react'

interface RebuyModalProps {
  minBuyin: number
  maxBuyin: number
  chipBalance: number
  autoRebuy: boolean
  onRebuy: (amount: number, autoRebuy: boolean) => void
  onLeave: () => void
}

export function RebuyModal({ minBuyin, maxBuyin, chipBalance, autoRebuy: initialAutoRebuy, onRebuy, onLeave }: RebuyModalProps) {
  const effectiveMax = Math.min(maxBuyin, chipBalance)
  const canRebuy = chipBalance >= minBuyin

  const [amount, setAmount] = useState(Math.min(maxBuyin, effectiveMax))
  const [autoRebuy, setAutoRebuy] = useState(initialAutoRebuy)

  // If auto-rebuy was previously enabled, fire immediately
  useEffect(() => {
    if (initialAutoRebuy && canRebuy) {
      onRebuy(Math.min(maxBuyin, effectiveMax), true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 shadow-2xl text-center">
        <div className="text-4xl mb-3">💸</div>
        <h2 className="text-white text-xl font-bold mb-1">You went bust!</h2>
        <p className="text-gray-400 text-sm mb-5">Would you like to rebuy and keep playing?</p>

        {canRebuy ? (
          <>
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{minBuyin.toLocaleString()}</span>
                <span className="text-yellow-400 font-bold">{amount.toLocaleString()} chips</span>
                <span>{effectiveMax.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={minBuyin}
                max={effectiveMax}
                step={Math.max(1, Math.floor(minBuyin / 10))}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full accent-yellow-400"
              />
              <div className="text-gray-500 text-xs mt-1">
                Your balance: <span className="text-white">{chipBalance.toLocaleString()} chips</span>
              </div>
            </div>

            <label className="flex items-center justify-center gap-2 text-sm text-gray-300 cursor-pointer mb-5">
              <input
                type="checkbox"
                checked={autoRebuy}
                onChange={(e) => setAutoRebuy(e.target.checked)}
                className="accent-yellow-400"
              />
              Auto-rebuy next time
            </label>

            <div className="flex gap-3">
              <button
                onClick={onLeave}
                className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-white text-sm transition-colors"
              >
                Leave
              </button>
              <button
                onClick={() => onRebuy(amount, autoRebuy)}
                className="flex-1 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition-colors"
              >
                Rebuy
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-red-400 text-sm mb-5">Not enough chips to rebuy (need {minBuyin.toLocaleString()}).</p>
            <button
              onClick={onLeave}
              className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors"
            >
              Leave Table
            </button>
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'

interface BetSliderProps {
  minRaise: number
  maxRaise: number
  bigBlind: number
  callAmount: number
  onRaise: (amount: number) => void
  onCancel: () => void
}

export function BetSlider({ minRaise, maxRaise, bigBlind, callAmount, onRaise, onCancel }: BetSliderProps) {
  const [amount, setAmount] = useState(minRaise)

  const setPreset = useCallback((value: number) => {
    setAmount(Math.min(maxRaise, Math.max(minRaise, value)))
  }, [minRaise, maxRaise])

  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-xl p-4 w-72">
      <div className="flex justify-between items-center mb-3">
        <span className="text-gray-400 text-sm">Raise Amount</span>
        <span className="text-yellow-400 font-bold text-lg">{amount.toLocaleString()}</span>
      </div>

      <input
        type="range"
        min={minRaise}
        max={maxRaise}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="w-full accent-yellow-400 mb-3"
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { label: 'Min', value: minRaise },
          { label: '½ Pot', value: Math.round(callAmount * 1.5) },
          { label: 'Pot', value: callAmount * 2 },
          { label: '2× Pot', value: callAmount * 4 },
          { label: 'Max', value: maxRaise },
        ].map(({ label, value }) => (
          <button
            key={label}
            onClick={() => setPreset(value)}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" className="flex-1" onClick={() => onRaise(amount)}>
          Raise {amount.toLocaleString()}
        </Button>
      </div>
    </div>
  )
}

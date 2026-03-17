'use client'

import { useCallback, useEffect, useState } from 'react'
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
  const clampAmount = useCallback((value: number) => {
    const rounded = Math.round(value)
    return Math.min(maxRaise, Math.max(minRaise, rounded))
  }, [minRaise, maxRaise])

  const [amountInput, setAmountInput] = useState(() => String(clampAmount(minRaise)))

  const parsedAmount = amountInput.trim() === '' ? NaN : Number(amountInput)
  const amount = Number.isFinite(parsedAmount) ? clampAmount(parsedAmount) : minRaise

  useEffect(() => {
    setAmountInput((current) => {
      if (current.trim() === '') return String(minRaise)
      return String(clampAmount(Number(current)))
    })
  }, [clampAmount, minRaise])

  const updateAmount = useCallback((value: number) => {
    setAmountInput(String(clampAmount(value)))
  }, [clampAmount])

  const setPreset = useCallback((value: number) => {
    updateAmount(value)
  }, [updateAmount])

  const handleAmountInput = useCallback((value: string) => {
    setAmountInput(value.replace(/[^\d]/g, ''))
  }, [])

  const handleRaise = useCallback(() => {
    onRaise(amount)
  }, [amount, onRaise])

  return (
    <div className="w-72 rounded-xl border border-gray-700 bg-gray-900/95 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-gray-400">Raise Amount</span>
        <span className="text-lg font-bold text-yellow-400">{amount.toLocaleString()}</span>
      </div>

      <div className="mb-3">
        <label
          htmlFor="raise-amount-input"
          className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500"
        >
          Enter Chips
        </label>
        <input
          id="raise-amount-input"
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          value={amountInput}
          onChange={(e) => handleAmountInput(e.target.value)}
          onBlur={() => setAmountInput(String(amount))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleRaise()
            }
          }}
          placeholder={minRaise.toLocaleString()}
          className="w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-yellow-500"
        />
        <div className="mt-1 flex justify-between text-[11px] text-gray-500">
          <span>Min {minRaise.toLocaleString()}</span>
          <span>Max {maxRaise.toLocaleString()}</span>
        </div>
      </div>

      <input
        type="range"
        min={minRaise}
        max={maxRaise}
        value={amount}
        onChange={(e) => updateAmount(Number(e.target.value))}
        className="mb-3 w-full accent-yellow-400"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { label: 'Min', value: minRaise },
          { label: '1/2 Pot', value: Math.round(callAmount * 1.5) },
          { label: 'Pot', value: callAmount * 2 },
          { label: '2x Pot', value: callAmount * 4 },
          { label: 'Max', value: maxRaise },
        ].map(({ label, value }) => (
          <button
            key={label}
            type="button"
            onClick={() => setPreset(value)}
            className="rounded bg-gray-700 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-600"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" className="flex-1" onClick={handleRaise} disabled={amountInput.trim() === ''}>
          Raise {amount.toLocaleString()}
        </Button>
      </div>
    </div>
  )
}

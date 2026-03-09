'use client'

import { useState } from 'react'
import { PlayerAction } from '@/types/poker'
import { Button } from '@/components/ui/Button'
import { BetSlider } from './BetSlider'

interface ActionPanelProps {
  validActions: PlayerAction[]
  callAmount: number
  minRaise: number
  myStack: number
  bigBlind: number
  onAction: (action: PlayerAction, amount?: number) => void
  timeLeft: number
}

export function ActionPanel({ validActions, callAmount, minRaise, myStack, bigBlind, onAction, timeLeft }: ActionPanelProps) {
  const [showRaiseSlider, setShowRaiseSlider] = useState(false)

  if (validActions.length === 0) return null

  const maxRaise = myStack

  return (
    <div className="relative">
      {showRaiseSlider && (
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2">
          <BetSlider
            minRaise={minRaise}
            maxRaise={maxRaise}
            bigBlind={bigBlind}
            callAmount={callAmount}
            onRaise={(amount) => {
              setShowRaiseSlider(false)
              onAction('raise', amount)
            }}
            onCancel={() => setShowRaiseSlider(false)}
          />
        </div>
      )}

      <div className="flex items-center gap-2 bg-black/70 border border-gray-700 rounded-2xl px-4 py-3 backdrop-blur">
        {/* Timer */}
        <div className={`text-sm font-bold w-8 text-center ${timeLeft <= 10 ? 'text-red-400' : 'text-gray-400'}`}>
          {timeLeft}s
        </div>

        <div className="w-px h-8 bg-gray-700" />

        {/* Action buttons */}
        {validActions.includes('fold') && (
          <Button variant="danger" size="md" onClick={() => onAction('fold')}>
            Fold
          </Button>
        )}

        {validActions.includes('check') && (
          <Button variant="secondary" size="md" onClick={() => onAction('check')}>
            Check
          </Button>
        )}

        {validActions.includes('call') && callAmount > 0 && (
          <Button variant="secondary" size="md" onClick={() => onAction('call')}>
            Call {callAmount.toLocaleString()}
          </Button>
        )}

        {validActions.includes('raise') && (
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowRaiseSlider((v) => !v)}
          >
            Raise
          </Button>
        )}

        {validActions.includes('allin') && (
          <Button
            variant="primary"
            size="md"
            className="bg-red-600 hover:bg-red-500"
            onClick={() => onAction('allin')}
          >
            All In {myStack.toLocaleString()}
          </Button>
        )}
      </div>
    </div>
  )
}

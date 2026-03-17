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
  myCurrentBet: number
  bigBlind: number
  onAction: (action: PlayerAction, amount?: number) => void
  timeLeft: number
}

export function ActionPanel({ validActions, callAmount, minRaise, myStack, myCurrentBet, bigBlind, onAction, timeLeft }: ActionPanelProps) {
  const [showRaiseSlider, setShowRaiseSlider] = useState(false)

  if (validActions.length === 0) return null

  const maxRaise = myStack + myCurrentBet

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

      <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-gray-700 bg-black/70 px-3 py-3 backdrop-blur sm:px-4">
        {/* Timer */}
        <div className={`w-8 text-center text-sm font-bold ${timeLeft <= 10 ? 'text-red-400' : 'text-gray-400'}`}>
          {timeLeft}s
        </div>

        <div className="hidden h-8 w-px bg-gray-700 sm:block" />

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

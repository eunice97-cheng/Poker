'use client'

import { CardComponent } from './CardComponent'
import { GamePhase } from '@/types/poker'

interface CommunityCardsProps {
  cards: string[]
  phase: GamePhase
  pot: number
}

const phaseLabel: Record<GamePhase, string> = {
  waiting: 'Waiting',
  preflop: 'Pre-Flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
}

export function CommunityCards({ cards, phase, pot }: CommunityCardsProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-gray-400 text-sm font-medium tracking-widest uppercase">
        {phaseLabel[phase]}
      </div>

      <div className="flex gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <CardComponent
            key={i}
            card={cards[i] ?? ''}
            size="lg"
            className={!cards[i] ? 'opacity-20 bg-gray-700 border-gray-600' : ''}
          />
        ))}
      </div>

      {pot > 0 && (
        <div className="bg-black/40 border border-yellow-500/30 rounded-full px-6 py-1.5">
          <span className="text-yellow-400 font-bold">Pot: {pot.toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}

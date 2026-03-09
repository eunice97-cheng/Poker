'use client'

import { HandResult } from '@/types/poker'
import { CardComponent } from './CardComponent'
import { Button } from '@/components/ui/Button'

interface HandResultModalProps {
  result: HandResult
  onClose: () => void
}

export function HandResultModal({ result, onClose }: HandResultModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-yellow-500/40 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold text-yellow-400 text-center mb-4">
          {result.winners.length === 1 ? 'Winner!' : 'Split Pot!'}
        </h2>

        {/* Community Cards */}
        {result.community.length > 0 && (
          <div className="flex justify-center gap-2 mb-5">
            {result.community.map((card, i) => (
              <CardComponent key={i} card={card} size="md" />
            ))}
          </div>
        )}

        {/* Winners */}
        <div className="space-y-3 mb-5">
          {result.winners.map((winner, i) => (
            <div key={i} className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-bold text-lg">{winner.username}</span>
                <span className="text-yellow-400 font-bold">+{winner.amount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {winner.holeCards.map((card, j) => (
                    <CardComponent key={j} card={card} size="sm" />
                  ))}
                </div>
                <span className="text-gray-400 text-sm">{winner.handRank}</span>
              </div>
            </div>
          ))}
        </div>

        {/* All hole cards (non-winners) */}
        {result.allHoleCards.filter(p => !result.winners.find(w => w.playerId === p.playerId)).length > 0 && (
          <div className="border-t border-gray-700 pt-4 mb-5">
            <p className="text-gray-500 text-xs mb-3 uppercase tracking-wider">Other Hands</p>
            <div className="space-y-2">
              {result.allHoleCards
                .filter(p => !result.winners.find(w => w.playerId === p.playerId))
                .map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm w-24 truncate">{p.username}</span>
                    <div className="flex gap-1">
                      {p.holeCards.map((card, j) => (
                        <CardComponent key={j} card={card} size="sm" />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        <Button variant="primary" className="w-full" onClick={onClose}>
          Continue
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { HandResult } from '@/types/poker'
import { CardComponent } from './CardComponent'

interface HandResultModalProps {
  result: HandResult
  onClose: () => void
  backImage?: string
  myPlayerId?: string
}

export function HandResultModal({
  result,
  onClose,
  backImage,
  myPlayerId,
}: HandResultModalProps) {
  const [countdown, setCountdown] = useState(8)
  const myWinner = myPlayerId ? result.winners.find((winner) => winner.playerId === myPlayerId) : undefined
  const myShownHand = myPlayerId ? result.allHoleCards.find((player) => player.playerId === myPlayerId) : undefined
  const myCards = myWinner?.holeCards ?? myShownHand?.holeCards ?? []
  const otherHands = result.allHoleCards.filter((player) => player.playerId !== myPlayerId)
  const otherLosingHands = otherHands.filter((player) => !result.winners.some((winner) => winner.playerId === player.playerId))
  const visibleWinners = myPlayerId
    ? result.winners.filter((winner) => winner.playerId !== myPlayerId)
    : result.winners
  const resultTitle = myPlayerId
    ? myWinner
      ? 'You Won'
      : 'You Lost'
    : result.winners.length === 1
      ? 'Winner'
      : 'Split Pot'
  const resultAmount = myWinner
    ? `+${myWinner.amount.toLocaleString()}`
    : result.winners.map((winner) => winner.username).join(', ')

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          onClose()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onClose])

  return (
    <div className="casino-hand-result-modal fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="casino-hand-result-modal__panel mx-4 w-full max-w-lg rounded-2xl border border-yellow-500/40 bg-gray-900 p-6 shadow-2xl">
        <div className="casino-hand-result-modal__header mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="casino-hand-result-modal__eyebrow text-xs font-semibold uppercase tracking-[0.22em] text-yellow-200/60">
              Hand Result
            </p>
            <h2 className="casino-hand-result-modal__title text-2xl font-bold text-yellow-400">
              {resultTitle}
            </h2>
          </div>
          <div className="text-right">
            <div className={`casino-hand-result-modal__amount text-lg font-bold ${myWinner ? 'text-yellow-300' : 'text-gray-300'}`}>
              {resultAmount || 'No payout'}
            </div>
            <span className="casino-hand-result-modal__countdown text-sm text-gray-500">
              Closing in {countdown}s
            </span>
          </div>
        </div>

        {result.community.length > 0 && (
          <div className="casino-hand-result-modal__community mb-5 flex justify-center gap-2">
            {result.community.map((card, i) => (
              <CardComponent key={i} card={card} size="md" backImage={backImage} />
            ))}
          </div>
        )}

        <div className="casino-hand-result-modal__body">
          {myPlayerId && (
            <div className={`casino-hand-result-modal__mine mb-5 rounded-xl border p-4 ${myWinner ? 'border-yellow-500/35 bg-yellow-500/10' : 'border-white/10 bg-white/5'}`}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-lg font-bold text-white">Your hand</span>
                <span className={`text-lg font-bold ${myWinner ? 'text-yellow-300' : 'text-gray-300'}`}>
                  {myWinner ? `+${myWinner.amount.toLocaleString()}` : 'No payout'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {myCards.length > 0 ? (
                  <div className="flex gap-1">
                    {myCards.map((card, i) => (
                      <CardComponent key={`${card}-${i}`} card={card} size="sm" backImage={backImage} />
                    ))}
                  </div>
                ) : null}
                <span className={`text-sm font-semibold ${myWinner ? 'text-yellow-300' : 'text-gray-400'}`}>
                  {myWinner?.handRank ?? 'Did not win this hand'}
                </span>
              </div>
            </div>
          )}

          {visibleWinners.length > 0 && (
            <div className="casino-hand-result-modal__winners mb-5 space-y-3">
              {visibleWinners.map((winner, i) => (
                <div key={i} className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-lg font-bold text-white">{winner.username}</span>
                    <span className="text-lg font-bold text-yellow-400">+{winner.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {winner.holeCards.length > 0 ? (
                      <div className="flex gap-1">
                        {winner.holeCards.map((card, j) => (
                          <CardComponent key={`${card}-${j}`} card={card} size="sm" backImage={backImage} />
                        ))}
                      </div>
                    ) : null}
                    <span className="text-sm font-semibold text-yellow-300">
                      {winner.handRank}
                      {winner.potCount && winner.potCount > 1 ? ` - ${winner.potCount} pots` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {otherLosingHands.length > 0 && (
            <div className="casino-hand-result-modal__others mb-5 border-t border-gray-700 pt-4">
              <p className="mb-3 text-xs uppercase tracking-wider text-gray-500">Other Hands</p>
              <div className="space-y-2">
                {otherLosingHands.map((player, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-24 truncate text-sm text-gray-400">{player.username}</span>
                    <div className="flex gap-1">
                      {player.holeCards.map((card, j) => (
                        <CardComponent key={`${card}-${j}`} card={card} size="sm" backImage={backImage} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="casino-hand-result-modal__continue w-full rounded-xl bg-yellow-500 py-2.5 font-bold text-black transition-colors hover:bg-yellow-400"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

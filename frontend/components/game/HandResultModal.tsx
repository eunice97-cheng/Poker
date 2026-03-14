'use client'

import { useEffect, useState } from 'react'
import { HandResult } from '@/types/poker'
import { CardComponent } from './CardComponent'

interface HandResultModalProps {
  result: HandResult
  onClose: () => void
  backImage?: string
  canTipDealer?: boolean
  dealerTipStack?: number
  onTipDealer?: (amount: number) => Promise<{ ok?: boolean; error?: string; stack?: number }>
}

const DEALER_TIP_AMOUNTS = [100, 500, 1000]

export function HandResultModal({
  result,
  onClose,
  backImage,
  canTipDealer = false,
  dealerTipStack = 0,
  onTipDealer,
}: HandResultModalProps) {
  const [countdown, setCountdown] = useState(8)
  const [tipBusyAmount, setTipBusyAmount] = useState<number | null>(null)
  const [tipError, setTipError] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { onClose(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onClose])

  const handleTip = async (amount: number) => {
    if (!onTipDealer) return

    setTipBusyAmount(amount)
    setTipError('')

    const res = await onTipDealer(amount)
    if (res?.error) {
      setTipError(res.error)
      setTipBusyAmount(null)
      return
    }

    setTipBusyAmount(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-yellow-500/40 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-yellow-400">
            {result.winners.length === 1 ? 'Winner!' : 'Split Pot!'}
          </h2>
          <span className="text-gray-500 text-sm">Closing in {countdown}s</span>
        </div>

        {/* Community Cards */}
        {result.community.length > 0 && (
          <div className="flex justify-center gap-2 mb-5">
            {result.community.map((card, i) => (
              <CardComponent key={i} card={card} size="md" backImage={backImage} />
            ))}
          </div>
        )}

        {/* Winners */}
        <div className="space-y-3 mb-5">
          {result.winners.map((winner, i) => (
            <div key={i} className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-bold text-lg">{winner.username}</span>
                <span className="text-yellow-400 font-bold text-lg">+{winner.amount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-3">
                {winner.holeCards.length > 0 ? (
                  <div className="flex gap-1">
                    {winner.holeCards.map((card, j) => (
                      <CardComponent key={j} card={card} size="sm" backImage={backImage} />
                    ))}
                  </div>
                ) : null}
                <span className="text-yellow-300 text-sm font-semibold">{winner.handRank}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Other hands shown at showdown */}
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
                        <CardComponent key={j} card={card} size="sm" backImage={backImage} />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {canTipDealer && (
          <div className="mb-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-cyan-200">Thank the dealer</div>
                <div className="mt-1 text-xs text-cyan-50/75">
                  Optional tip from your live table stack.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {DEALER_TIP_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleTip(amount)}
                    disabled={!onTipDealer || dealerTipStack < amount || tipBusyAmount !== null}
                    className="rounded-lg border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-200 transition-colors hover:border-cyan-500 hover:text-white disabled:cursor-not-allowed disabled:border-gray-700 disabled:text-gray-600"
                  >
                    {tipBusyAmount === amount ? 'Tipping...' : `Tip ${amount.toLocaleString()}`}
                  </button>
                ))}
              </div>
            </div>
            {tipError && <p className="mt-3 text-xs text-red-400">{tipError}</p>}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2.5 rounded-xl transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

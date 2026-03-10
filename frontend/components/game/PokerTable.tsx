'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { GameState, HandResult, ChatMessage } from '@/types/poker'
import { PlayerSeat } from './PlayerSeat'
import { CommunityCards } from './CommunityCards'
import { ActionPanel } from './ActionPanel'
import { HandResultModal } from './HandResultModal'
import { ChatBox } from './ChatBox'
import { ActionLog } from './ActionLog'

// ─── Scene geometry (all px) ─────────────────────────────────────────────────
// Scene: 728 × 500 px
// Oval (rail outer edge): cx=364, cy=310, rx=325, ry=117  → 2.78:1 ratio
// Dealer + speech sit in the top ~190 px above the oval
// Seats are placed on the ellipse perimeter and anchored AWAY from the oval
// so they never overlap the felt surface.

const SCENE_W = 728
const SCENE_H = 500

const OW  = 650   // oval width  (rx = 325)
const OH  = 234   // oval height (ry = 117)
const OCX = 364   // oval centre x
const OCY = 310   // oval centre y

// Gap between oval edge and the nearest edge of the seat element
const PAD_X = 18
const PAD_Y = 18

/**
 * Returns absolute-position CSS for a seat at `angleDeg` on the ellipse.
 * The seat is anchored so it grows *away* from the oval centre,
 * preventing any overlap with the felt surface.
 *
 *  angleDeg=0   → right
 *  angleDeg=90  → top  (dealer lives here — don't place seats here)
 *  angleDeg=180 → left
 *  angleDeg=270 → bottom
 */
function ellipsePt(angleDeg: number): React.CSSProperties {
  const rad = (angleDeg * Math.PI) / 180
  const x = Math.round(OCX + (OW / 2 + PAD_X) * Math.cos(rad))
  const y = Math.round(OCY - (OH / 2 + PAD_Y) * Math.sin(rad))

  const sinA = Math.sin(rad)

  // Anchor the seat element so it grows away from oval centre
  // |sinA| > 0.5  → primarily above or below → vertical anchoring
  // |sinA| ≤ 0.5  → primarily left or right → horizontal anchoring
  let tx: string, ty: string
  if (Math.abs(sinA) > 0.5) {
    tx = '-50%'
    ty = sinA > 0 ? '-100%' : '0%'   // top half → hang up; bottom half → grow down
  } else {
    const cosA = Math.cos(rad)
    tx = cosA > 0 ? '0%' : '-100%'   // right half → grow right; left half → hang left
    ty = '-50%'
  }

  return {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    transform: `translate(${tx}, ${ty})`,
  }
}

// Seat angles — 90° is dealer (top-centre), kept clear
const SEAT_POSITIONS: Record<number, React.CSSProperties> = {
  0: ellipsePt(270),   // bottom-centre  (human player)
  1: ellipsePt(220),   // bottom-left
  2: ellipsePt(155),   // left-ish
  3: ellipsePt(112),   // top-left
  4: ellipsePt(68),    // top-right
  5: ellipsePt(25),    // right-ish
  6: ellipsePt(320),   // bottom-right
  7: ellipsePt(200),   // left
  8: ellipsePt(340),   // right
}

interface PokerTableProps {
  gameState: GameState
  handResult: HandResult | null
  messages: ChatMessage[]
  actionLogs: string[]
  timeLeft: number
  onAction: (action: string, amount?: number) => void
  onChat: (text: string) => void
  onLeave: () => void
  onSitOut: () => void
  onSitIn: () => void
  clearHandResult: () => void
  countdown: number | null
}

export function PokerTable({
  gameState,
  handResult,
  messages,
  actionLogs,
  timeLeft,
  onAction,
  onChat,
  onLeave,
  onSitOut,
  onSitIn,
  clearHandResult,
  countdown,
}: PokerTableProps) {
  const me = gameState.players.find((p) => p.playerId === gameState.myPlayerId)
  const isMyTurn = me?.isCurrentTurn ?? false
  const isSittingOut = me?.sittingOut ?? false

  // Dealer speech bubble — latest action log, fades after 3.5 s
  const [dealerSpeech, setDealerSpeech] = useState('')
  useEffect(() => {
    if (actionLogs.length === 0) return
    const latest = actionLogs[actionLogs.length - 1]
    setDealerSpeech(latest)
    const t = setTimeout(() => setDealerSpeech(''), 3500)
    return () => clearTimeout(t)
  }, [actionLogs])

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden flex flex-col">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-800 z-10 flex-shrink-0">
        <div className="text-white font-bold">{gameState.tableName}</div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>Hand #{gameState.handNumber}</span>
          <span>{gameState.smallBlind}/{gameState.bigBlind}</span>
          {me && <span className="text-yellow-400 font-bold">{me.stack.toLocaleString()} chips</span>}
        </div>
        <div className="flex items-center gap-2">
          {me && !isSittingOut && gameState.phase === 'waiting' && (
            <button onClick={onSitOut} className="text-gray-400 hover:text-yellow-400 text-sm border border-gray-700 px-3 py-1 rounded-lg transition-colors">
              Stand Up
            </button>
          )}
          {me && isSittingOut && (
            <button onClick={onSitIn} className="text-yellow-400 hover:text-white text-sm border border-yellow-600 px-3 py-1 rounded-lg transition-colors">
              Sit Down
            </button>
          )}
          <button onClick={onLeave} className="text-gray-400 hover:text-red-400 text-sm border border-gray-700 px-3 py-1 rounded-lg transition-colors">
            Leave Room
          </button>
        </div>
      </div>

      {/* ── Main area: single fixed-px scene, centred ── */}
      <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
        <div
          className="relative flex-shrink-0"
          style={{ width: `${SCENE_W}px`, height: `${SCENE_H}px` }}
        >

          {/* ── Dealer (Eunice) — top-centre of scene ── */}
          <div
            className="absolute z-30 flex flex-col items-center"
            style={{ top: 0, left: '50%', transform: 'translateX(-50%)' }}
          >
            <Image
              src="/Eunice1.png"
              alt="Dealer"
              width={90}
              height={120}
              className="object-contain object-top select-none"
              style={{
                height: '120px',
                width: 'auto',
                filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.9))',
              }}
              priority
            />

            {/* Speech bubble below dealer — arrow points UP toward dealer */}
            {dealerSpeech && (
              <div
                className="relative bg-white text-gray-900 text-[11px] font-semibold
                            px-3 py-1.5 rounded-2xl shadow-xl max-w-[220px] text-center leading-snug mt-1"
              >
                {/* Triangle pointing UP toward dealer */}
                <span
                  className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-0 h-0 block"
                  style={{
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderBottom: '7px solid white',
                  }}
                />
                {dealerSpeech}
              </div>
            )}
          </div>

          {/* ── Felt oval ── */}
          <div
            className="absolute rounded-[50%] bg-amber-950 shadow-[0_0_80px_rgba(0,0,0,0.9)]"
            style={{
              left:   `${OCX - OW / 2}px`,   // 39 px
              top:    `${OCY - OH / 2}px`,   // 193 px
              width:  `${OW}px`,             // 650 px
              height: `${OH}px`,             // 234 px
            }}
          >
            {/* Rail sheen */}
            <div className="absolute inset-[4px] rounded-[50%] bg-gradient-to-b from-amber-700/40 to-transparent" />
            {/* Felt surface */}
            <div className="absolute inset-[12px] rounded-[50%] bg-felt">
              <div className="absolute inset-4 rounded-[50%] border border-felt-light/20" />
              {/* Centre content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                {countdown !== null && gameState.phase === 'waiting' && (
                  <div className="text-white text-base font-bold animate-pulse">
                    Starting in {countdown}s…
                  </div>
                )}
                {gameState.phase === 'waiting' && countdown === null && (
                  <div className="text-gray-300 text-sm">Waiting for players…</div>
                )}
                {gameState.phase !== 'waiting' && (
                  <CommunityCards cards={gameState.community} phase={gameState.phase} pot={gameState.pot} />
                )}
              </div>
            </div>
          </div>

          {/* ── Player seats — anchored away from oval ── */}
          {gameState.players.map((player) => {
            const pos = SEAT_POSITIONS[player.seat]
            if (!pos) return null
            return (
              <div key={player.playerId} className="absolute z-10" style={pos}>
                <PlayerSeat
                  player={player}
                  timeLeft={isMyTurn && player.isCurrentTurn ? timeLeft : undefined}
                  actionTimeLimit={30}
                />
              </div>
            )
          })}

        </div>
      </div>

      {/* ── Action bar ── */}
      <div className="flex-shrink-0 flex items-center justify-center py-3 px-4 bg-gray-900/80 border-t border-gray-800 min-h-[76px] z-20 gap-4">
        {gameState.myHandRank && gameState.phase !== 'waiting' && (
          <div className="text-center hidden sm:block">
            <div className="text-yellow-400 text-xs font-bold uppercase tracking-wide">{gameState.myHandRank}</div>
            <div className="text-gray-600 text-xs">your hand</div>
          </div>
        )}
        {isMyTurn && gameState.validActions.length > 0 ? (
          <ActionPanel
            validActions={gameState.validActions}
            callAmount={gameState.callAmount}
            minRaise={gameState.minRaise}
            myStack={me?.stack ?? 0}
            bigBlind={gameState.bigBlind}
            onAction={(action, amount) => onAction(action, amount)}
            timeLeft={timeLeft}
          />
        ) : isSittingOut ? (
          <div className="flex items-center gap-3">
            <span className="text-yellow-500 text-sm">You are sitting out</span>
            <button onClick={onSitIn} className="bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold px-4 py-2 rounded-lg transition-colors">
              Sit Down
            </button>
          </div>
        ) : gameState.phase !== 'waiting' ? (
          <p className="text-gray-500 text-sm">
            Waiting for <span className="text-white">{gameState.players.find(p => p.isCurrentTurn)?.username ?? '…'}</span> to act
          </p>
        ) : (
          <p className="text-gray-600 text-sm">Waiting for players to join…</p>
        )}
      </div>

      {/* ── Side panel: Action log + Chat ── */}
      <div className="absolute bottom-24 right-4 w-64 z-10 flex flex-col gap-2">
        <ActionLog logs={actionLogs} />
        <ChatBox messages={messages} onSend={onChat} myPlayerId={gameState.myPlayerId} />
      </div>

      {/* ── Hand result overlay ── */}
      {handResult && (
        <HandResultModal result={handResult} onClose={clearHandResult} />
      )}
    </div>
  )
}

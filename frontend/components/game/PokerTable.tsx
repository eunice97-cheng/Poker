'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { GameState, HandResult, ChatMessage, ClientObserver } from '@/types/poker'
import { PlayerSeat } from './PlayerSeat'
import { CommunityCards } from './CommunityCards'
import { ActionPanel } from './ActionPanel'
import { HandResultModal } from './HandResultModal'
import { ChatBox } from './ChatBox'
import { ActionLog } from './ActionLog'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { getTableTheme } from '@/lib/table-theme'
import { getDealerImage, getDeckBackImage } from '@/lib/table-assets'

// ─── Scene geometry (all px) ─────────────────────────────────────────────────
// Scene: 800 × 520 px
// Oval: cx=400, cy=295, rx=290, ry=105
// Dealer (144px tall) sits just above the oval at top-centre
// Seats avoid the 60°–120° top arc (dealer zone)

const SCENE_W = 800
const SCENE_H = 520

const OW  = 580   // oval width  (rx = 290)
const OH  = 210   // oval height (ry = 105)
const OCX = 400   // oval centre x
const OCY = 295   // oval centre y

const PAD_X = 16
const PAD_Y = 16

function ellipsePt(angleDeg: number): React.CSSProperties {
  const rad = (angleDeg * Math.PI) / 180
  const x = Math.round(OCX + (OW / 2 + PAD_X) * Math.cos(rad))
  const y = Math.round(OCY - (OH / 2 + PAD_Y) * Math.sin(rad))

  const sinA = Math.sin(rad)

  let tx: string, ty: string
  if (Math.abs(sinA) > 0.5) {
    tx = '-50%'
    ty = sinA > 0 ? '-100%' : '0%'
  } else {
    const cosA = Math.cos(rad)
    tx = cosA > 0 ? '0%' : '-100%'
    ty = '-50%'
  }

  return {
    position: 'absolute',
    left: x + 'px',
    top:  y + 'px',
    transform: 'translate(' + tx + ', ' + ty + ')',
  }
}

// 6 seat positions — avoids 60°–120° top arc (dealer zone)
const SEAT_POSITIONS: Record<number, React.CSSProperties> = {
  0: ellipsePt(270),   // bottom-centre
  1: ellipsePt(220),   // lower-left
  2: ellipsePt(152),   // upper-left  (|sin|~0.47 → horizontal anchor)
  3: ellipsePt(28),    // upper-right (|sin|~0.47 → horizontal anchor)
  4: ellipsePt(320),   // lower-right
  5: ellipsePt(195),   // left side
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
  const observers: ClientObserver[] = gameState.observers ?? []
  const isObserver = !me && observers.some(o => o.playerId === gameState.myPlayerId)
  const isMyTurn = me?.isCurrentTurn ?? false
  const dealerImage = getDealerImage(gameState.bigBlind)
  const deckBackImage = getDeckBackImage(gameState.bigBlind)
  const theme = getTableTheme(gameState.bigBlind)

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
    <div className={`relative w-full h-screen overflow-hidden flex flex-col ${theme.sceneClass}`}>

      {/* ── Top bar ── */}
      <div className={`flex items-center justify-between px-4 py-3 z-10 flex-shrink-0 ${theme.topBarClass}`}>
        <div className="text-white font-bold">{gameState.tableName}</div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>Hand #{gameState.handNumber}</span>
          <span className="text-white/90">{gameState.smallBlind}/{gameState.bigBlind}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
            {theme.tier}
          </span>
          {me && <span className="text-yellow-400 font-bold">{me.stack.toLocaleString()} chips</span>}
          {isObserver && <span className="text-gray-500 text-xs">Watching</span>}
        </div>
        <div className="flex items-center gap-2">
          {me && gameState.phase === 'waiting' && (
            <button onClick={onSitOut} className="text-gray-400 hover:text-yellow-400 text-sm border border-gray-700 px-3 py-1 rounded-lg transition-colors">
              Stand Up
            </button>
          )}
          {isObserver && (
            <button onClick={onSitIn} className="text-yellow-400 hover:text-white text-sm border border-yellow-600 px-3 py-1 rounded-lg transition-colors">
              Sit Down
            </button>
          )}
          {process.env.NEXT_PUBLIC_DISCORD_URL && (
            <a
              href={process.env.NEXT_PUBLIC_DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-3 py-1 rounded-lg transition-colors"
              title="Invite friends on Discord"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
              Invite
            </a>
          )}
          <button onClick={onLeave} className="text-gray-400 hover:text-red-400 text-sm border border-gray-700 px-3 py-1 rounded-lg transition-colors">
            Leave Room
          </button>
        </div>
      </div>

      {/* ── Main area: aligned to top ── */}
      <div className="flex-1 flex items-start justify-center min-h-0 overflow-hidden pt-2">
        <div
          className="relative flex-shrink-0"
          style={{ width: SCENE_W + 'px', height: SCENE_H + 'px' }}
        >

          {/* ── Dealer (Eunice) — top-centre ── */}
          <div
            className="absolute z-30 flex flex-col items-center"
            style={{ top: 0, left: '50%', transform: 'translateX(-50%)' }}
          >
            <div className={`absolute top-5 h-20 w-20 rounded-full blur-2xl ${theme.dealerGlowClass}`} />
            <Image
              src={dealerImage}
              alt="Dealer"
              width={108}
              height={144}
              className="object-contain object-top select-none"
              style={{
                height: '144px',
                width: 'auto',
                filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.9))',
              }}
              priority
            />

            {/* Speech bubble — arrow points UP toward dealer */}
            {dealerSpeech && (
              <div
                className="relative bg-white text-gray-900 text-[11px] font-semibold
                            px-3 py-1.5 rounded-2xl shadow-xl max-w-[220px] text-center leading-snug mt-1"
              >
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
            className={`absolute rounded-[50%] ${theme.feltRailClass}`}
            style={{
              left:   (OCX - OW / 2) + 'px',
              top:    (OCY - OH / 2) + 'px',
              width:  OW + 'px',
              height: OH + 'px',
            }}
          >
            <div className={`absolute inset-[4px] rounded-[50%] ${theme.feltRailInsetClass}`} />
            <div className={`absolute inset-[12px] rounded-[50%] ${theme.feltSurfaceClass}`}>
              <div className={`absolute inset-4 rounded-[50%] border ${theme.feltInnerRingClass}`} />
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
                  <CommunityCards cards={gameState.community} phase={gameState.phase} pot={gameState.pot} backImage={deckBackImage} />
                )}
              </div>
            </div>
          </div>

          {/* ── Player seats ── */}
          {gameState.players.map((player) => {
            const pos = SEAT_POSITIONS[player.seat]
            if (!pos) return null
            return (
              <div key={player.playerId} className="absolute z-10" style={pos}>
                <PlayerSeat
                  player={player}
                  timeLeft={isMyTurn && player.isCurrentTurn ? timeLeft : undefined}
                  actionTimeLimit={30}
                  backImage={deckBackImage}
                />
              </div>
            )
          })}

          {/* ── Observer panel — right side ── */}
          {observers.length > 0 && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 min-w-[110px]">
              <div className="text-gray-600 text-[10px] uppercase tracking-wide text-center mb-0.5">Watching</div>
              {observers.map((obs) => (
                <div
                  key={obs.playerId}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${theme.sidePanelClass}`}
                >
                  <AvatarDisplay avatarId={obs.avatar ?? 'avatar_m1'} size="sm" />
                  <div>
                    <div className="text-white text-[11px] font-semibold truncate max-w-[72px]">{obs.username}</div>
                    <div className="text-yellow-500 text-[10px]">{obs.stack.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ── Action bar ── */}
      <div className={`flex-shrink-0 flex items-center justify-center py-3 px-4 min-h-[76px] z-20 gap-4 ${theme.actionBarClass}`}>
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
        ) : isObserver ? (
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm">Watching the game</span>
            {gameState.phase === 'waiting' && (
              <button onClick={onSitIn} className="bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold px-4 py-2 rounded-lg transition-colors">
                Sit Down
              </button>
            )}
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
        <HandResultModal result={handResult} onClose={clearHandResult} backImage={deckBackImage} />
      )}
    </div>
  )
}

'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { GameState, HandResult, ChatMessage, ClientObserver } from '@/types/poker'
import { PlayerSeat } from './PlayerSeat'
import { CommunityCards } from './CommunityCards'
import { ActionPanel } from './ActionPanel'
import { HandResultModal } from './HandResultModal'
import { ChatBox } from './ChatBox'
import { ActionLog } from './ActionLog'
import { TableBuzzer } from './TableBuzzer'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { AudioControls } from '@/components/ui/AudioControls'
import { getTableTheme } from '@/lib/table-theme'
import { getDealerImage, getDeckBackImage, getTableImage } from '@/lib/table-assets'
import { buildTableInvite, shareInvite } from '@/lib/invite'
import { useAudio } from '@/hooks/useAudio'
import type { BuzzerHousePlayer, BuzzerRoom } from '@/lib/buzzer'

const SCENE_W = 800
const SCENE_H = 520

const OW = 580
const OH = 210
const OCX = 400
const OCY = 313
const TABLE_W = 706
const TABLE_H = 338
const TABLE_LEFT = Math.round(OCX - TABLE_W / 2)
const TABLE_TOP = 136
const DEALER_TOP = 0

const PAD_X = 16
const PAD_Y = 16
const HOUSE_AI_NAMES = ['Alice', 'Bernice', 'Candice', 'Denice', 'Felice', 'Gillece'] as const
const DEALER_TIP_AMOUNTS = [100, 500, 1000] as const

function ellipsePt(angleDeg: number): React.CSSProperties {
  const rad = (angleDeg * Math.PI) / 180
  const x = Math.round(OCX + (OW / 2 + PAD_X) * Math.cos(rad))
  const y = Math.round(OCY - (OH / 2 + PAD_Y) * Math.sin(rad))

  const sinA = Math.sin(rad)

  let tx: string
  let ty: string
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
    left: `${x}px`,
    top: `${y}px`,
    transform: `translate(${tx}, ${ty})`,
  }
}

const SEAT_POSITIONS: Record<number, React.CSSProperties> = {
  0: ellipsePt(270),
  1: ellipsePt(220),
  2: ellipsePt(152),
  3: ellipsePt(28),
  4: ellipsePt(320),
  5: ellipsePt(195),
}

function getDealerSpeechForLog(message: string) {
  const trimmed = message.trim()
  const speakingBot = HOUSE_AI_NAMES.find((name) => trimmed.startsWith(`${name} `))
  if (speakingBot) {
    const remainder = trimmed.slice(speakingBot.length + 1).toLowerCase()
    const isPlayerAction =
      remainder.startsWith('folds')
      || remainder.startsWith('checks')
      || remainder.startsWith('calls')
      || remainder.startsWith('raises')
      || remainder.startsWith('goes all in')

    return isPlayerAction ? trimmed : ''
  }

  const lifecycleLines: Array<{ suffix: string; speech: (name: string) => string }> = [
    { suffix: ' joined the game', speech: (name) => `Welcome to the table, ${name}.` },
    { suffix: ' takes a seat', speech: (name) => `Welcome in, ${name}.` },
    {
      suffix: ' takes a rail seat until this hand finishes',
      speech: (name) => `Hang tight, ${name}. I will seat you after this hand.`,
    },
    { suffix: ' stands up', speech: (name) => `Good game, ${name}.` },
    { suffix: ' will stand up after this hand', speech: (name) => `All right, ${name}. One more hand for you.` },
    { suffix: ' left the room', speech: (name) => `Take care, ${name}.` },
  ]

  for (const line of lifecycleLines) {
    if (!trimmed.endsWith(line.suffix)) continue
    const name = trimmed.slice(0, -line.suffix.length).trim()
    if (!name) return trimmed
    return line.speech(name)
  }

  const tipMatch = trimmed.match(/^(.+?) tips the dealer(?:\s+\d[\d,]*)?$/i)
  if (tipMatch?.[1]) {
    return `Thank you for the tip, ${tipMatch[1].trim()}.`
  }

  return trimmed
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
  hasVipEmojis: boolean
  isAdmin: boolean
  buzzerRoom: BuzzerRoom | null
  housePlayers: BuzzerHousePlayer[]
  buzzerLoading: boolean
  buzzerError: string
  buzzerMessage: string
  buzzerActionPlayerId: string
  onOpenBuzzer: () => void
  onRefreshBuzzer: () => void
  onSummonHousePlayer: (housePlayerId: string) => void
  onDismissHousePlayer: (housePlayerId: string) => void
  onRejuvenateHousePlayer: (housePlayerId: string) => void
  onTipDealer: (amount: number) => Promise<{ ok?: boolean; error?: string; stack?: number }>
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
  hasVipEmojis,
  isAdmin,
  buzzerRoom,
  housePlayers,
  buzzerLoading,
  buzzerError,
  buzzerMessage,
  buzzerActionPlayerId,
  onOpenBuzzer,
  onRefreshBuzzer,
  onSummonHousePlayer,
  onDismissHousePlayer,
  onRejuvenateHousePlayer,
  onTipDealer,
}: PokerTableProps) {
  const me = gameState.players.find((p) => p.playerId === gameState.myPlayerId)
  const observers: ClientObserver[] = gameState.observers ?? []
  const isObserver = !me && observers.some((o) => o.playerId === gameState.myPlayerId)
  const canSitInNow = gameState.phase === 'waiting' || gameState.phase === 'showdown'
  const isMyTurn = me?.isCurrentTurn ?? false
  const canTipDealer = Boolean(me && !isObserver && !me.isBot && (gameState.phase === 'waiting' || gameState.phase === 'showdown'))
  const dealerImage = getDealerImage(gameState.bigBlind)
  const deckBackImage = getDeckBackImage(gameState.bigBlind)
  const tableImage = getTableImage(gameState.bigBlind)
  const theme = getTableTheme(gameState.bigBlind)
  const { playSfx } = useAudio()

  const [dealerSpeech, setDealerSpeech] = useState('')
  const [inviteLabel, setInviteLabel] = useState<'idle' | 'done'>('idle')
  const [sceneScale, setSceneScale] = useState(1)
  const [showMobilePanel, setShowMobilePanel] = useState(false)
  const [showBuzzer, setShowBuzzer] = useState(false)
  const [showDealerTipMenu, setShowDealerTipMenu] = useState(false)
  const [dealerTipBusyAmount, setDealerTipBusyAmount] = useState<number | null>(null)
  const [dealerTipError, setDealerTipError] = useState('')
  const lastShuffleKey = useRef('')
  const lastActionSfx = useRef('')
  const lastResultKey = useRef('')

  useEffect(() => {
    if (actionLogs.length === 0) return
    const latest = actionLogs[actionLogs.length - 1]
    const speech = getDealerSpeechForLog(latest)
    if (!speech) {
      setDealerSpeech('')
      return
    }
    setDealerSpeech(speech)
    const timeout = setTimeout(() => setDealerSpeech(''), 3500)
    return () => clearTimeout(timeout)
  }, [actionLogs])

  useEffect(() => {
    if (actionLogs.length === 0) return

    const latest = actionLogs[actionLogs.length - 1]
    if (latest === lastActionSfx.current) return
    lastActionSfx.current = latest

    const normalized = latest.toLowerCase()
    if (normalized.includes('all in')) {
      playSfx('allin')
      return
    }

    if (normalized.includes('folds')) {
      playSfx('fold')
      return
    }

    if (normalized.includes('checks')) {
      playSfx('check')
      return
    }

    if (normalized.includes('raises to') || normalized.includes('raises all in')) {
      playSfx('raise')
      return
    }

    if (normalized.includes('calls')) {
      playSfx('call')
    }
  }, [actionLogs, playSfx])

  useEffect(() => {
    const updateSceneScale = () => {
      if (typeof window === 'undefined') return
      const isMobile = window.innerWidth < 640
      const horizontalScale = (window.innerWidth - (isMobile ? 8 : 20)) / SCENE_W
      const verticalScale = (window.innerHeight - (isMobile ? 220 : 280)) / SCENE_H
      setSceneScale(Math.min(1, horizontalScale, verticalScale))
    }

    updateSceneScale()
    window.addEventListener('resize', updateSceneScale)
    return () => window.removeEventListener('resize', updateSceneScale)
  }, [])

  useEffect(() => {
    if (gameState.phase !== 'preflop') return

    const shuffleKey = `${gameState.tableId}:${gameState.handNumber}`
    if (shuffleKey === lastShuffleKey.current) return
    lastShuffleKey.current = shuffleKey
    playSfx('shuffle')
    setTimeout(() => {
      playSfx('deal')
    }, 250)
  }, [gameState.handNumber, gameState.phase, gameState.tableId, playSfx])

  useEffect(() => {
    if (!handResult) return

    const resultKey = `${gameState.tableId}:${gameState.handNumber}:${handResult.winners.map((winner) => winner.playerId).join(',')}`
    if (resultKey === lastResultKey.current) return
    lastResultKey.current = resultKey

    const iWon = handResult.winners.some((winner) => winner.playerId === gameState.myPlayerId)
    playSfx(iWon ? 'win' : 'lose')
  }, [gameState.handNumber, gameState.myPlayerId, gameState.tableId, handResult, playSfx])

  useEffect(() => {
    if (canTipDealer) return
    setShowDealerTipMenu(false)
    setDealerTipError('')
    setDealerTipBusyAmount(null)
  }, [canTipDealer])

  const handleInvite = async () => {
    try {
      await shareInvite(
        buildTableInvite(gameState.tableName, gameState.tableId, gameState.bigBlind),
        process.env.NEXT_PUBLIC_DISCORD_URL
      )
      setInviteLabel('done')
      setTimeout(() => setInviteLabel('idle'), 2000)
    } catch {
      alert('Could not copy the invite. Please try again.')
    }
  }

  const handleOpenBuzzer = () => {
    setShowBuzzer(true)
    onOpenBuzzer()
  }

  const handleDealerTip = async (amount: number) => {
    setDealerTipBusyAmount(amount)
    setDealerTipError('')

    const res = await onTipDealer(amount)
    if (res?.error) {
      setDealerTipError(res.error)
      setDealerTipBusyAmount(null)
      return
    }

    setDealerTipBusyAmount(null)
    setDealerTipError('')
    setShowDealerTipMenu(false)
  }

  return (
    <div className={`relative flex h-screen w-full flex-col overflow-hidden ${theme.sceneClass}`}>
      <div className={`z-10 flex shrink-0 flex-col gap-2 px-3 py-2.5 md:flex-row md:items-center md:justify-between md:px-4 md:py-3 ${theme.topBarClass}`}>
        <div className="truncate text-sm font-bold text-white md:text-base">{gameState.tableName}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 md:gap-4 md:text-sm">
          <span>Hand #{gameState.handNumber}</span>
          <span className="text-white/90">
            {gameState.smallBlind}/{gameState.bigBlind}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/80 md:text-[10px] md:tracking-[0.2em]">
            {theme.tier}
          </span>
          {me && <span className="font-bold text-yellow-400">{me.stack.toLocaleString()} chips</span>}
          {isObserver && <span className="text-xs text-gray-500">Watching</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {me && (
            <button
              onClick={onSitOut}
              disabled={!!me.standUpAfterHand}
              className="rounded-lg border border-gray-700 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:text-yellow-400 disabled:cursor-not-allowed disabled:border-yellow-700/50 disabled:text-yellow-500 md:px-3 md:text-sm"
            >
              {me.standUpAfterHand
                ? 'Leaving After Hand'
                : gameState.phase === 'waiting' || gameState.phase === 'showdown'
                  ? 'Stand Up'
                  : 'Stand Up After Hand'}
            </button>
          )}
          {isObserver && (
            <button
              onClick={onSitIn}
              disabled={!canSitInNow}
              className="rounded-lg border border-yellow-600 px-2.5 py-1 text-xs text-yellow-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:border-gray-700 disabled:text-gray-600 md:px-3 md:text-sm"
            >
              Sit Down
            </button>
          )}
          <button
            onClick={handleInvite}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 md:px-3 md:text-sm"
            title="Copy table invite and open Discord"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
            </svg>
            {inviteLabel === 'done' ? 'Copied' : 'Invite'}
          </button>
          {isAdmin && (
            <button
              onClick={handleOpenBuzzer}
              className="rounded-lg border border-pink-500/60 bg-pink-500/10 px-2.5 py-1 text-xs font-semibold text-pink-200 transition-colors hover:border-pink-400 hover:text-white md:px-3 md:text-sm"
            >
              Buzzer
            </button>
          )}
          <AudioControls />
          <button
            onClick={onLeave}
            className="rounded-lg border border-gray-700 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:text-red-400 md:px-3 md:text-sm"
          >
            Leave Room
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-start justify-center overflow-hidden pt-2">
        <div
          className="relative shrink-0"
          style={{ width: `${SCENE_W * sceneScale}px`, height: `${SCENE_H * sceneScale}px` }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: `${SCENE_W}px`,
              height: `${SCENE_H}px`,
              transform: `scale(${sceneScale})`,
            }}
          >
          <div
            className="absolute z-30 flex flex-col items-center"
            style={{ top: `${DEALER_TOP}px`, left: '50%', transform: 'translateX(-50%)' }}
          >
            <div className={`absolute top-5 h-20 w-20 rounded-full blur-2xl ${theme.dealerGlowClass}`} />
            <button
              type="button"
              onClick={() => {
                if (!canTipDealer) return
                setShowDealerTipMenu((value) => !value)
                setDealerTipError('')
              }}
              disabled={!canTipDealer}
              className={canTipDealer ? 'cursor-pointer' : 'cursor-default'}
              title={canTipDealer ? 'Tip dealer' : undefined}
            >
              <Image
                src={dealerImage}
                alt="Dealer"
                width={108}
                height={144}
                className="select-none object-contain object-top"
                style={{
                  height: '144px',
                  width: 'auto',
                  filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.9))',
                }}
                priority
              />
            </button>

            {dealerSpeech && (
              <div className="relative mt-1 max-w-[220px] rounded-2xl bg-white px-3 py-1.5 text-center text-[11px] font-semibold leading-snug text-gray-900 shadow-xl">
                <span
                  className="absolute left-1/2 top-[-7px] block h-0 w-0 -translate-x-1/2"
                  style={{
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderBottom: '7px solid white',
                  }}
                />
                {dealerSpeech}
              </div>
            )}

            {canTipDealer && (
              <button
                type="button"
                onClick={() => {
                  setShowDealerTipMenu((value) => !value)
                  setDealerTipError('')
                }}
                className="mt-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:border-cyan-300 hover:text-white"
              >
                Tip Dealer
              </button>
            )}

            {showDealerTipMenu && canTipDealer && (
              <div className="mt-2 w-[240px] rounded-2xl border border-cyan-400/25 bg-gray-950/95 p-3 text-center shadow-2xl backdrop-blur-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Dealer Tip</div>
                <div className="mt-1 text-[11px] text-gray-400">Optional thanks from your table stack.</div>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {DEALER_TIP_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => handleDealerTip(amount)}
                      disabled={!me || me.stack < amount || dealerTipBusyAmount !== null}
                      className="rounded-lg border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-200 transition-colors hover:border-cyan-500 hover:text-white disabled:cursor-not-allowed disabled:border-gray-700 disabled:text-gray-600"
                    >
                      {dealerTipBusyAmount === amount ? 'Tipping...' : amount.toLocaleString()}
                    </button>
                  ))}
                </div>
                {dealerTipError && <p className="mt-3 text-xs text-red-400">{dealerTipError}</p>}
              </div>
            )}
          </div>

          <div
            className="absolute"
            style={{
              left: `${TABLE_LEFT}px`,
              top: `${TABLE_TOP}px`,
              width: `${TABLE_W}px`,
              height: `${TABLE_H}px`,
            }}
          >
            <Image
              src={tableImage}
              alt={`${theme.tier} poker table`}
              fill
              sizes="706px"
              className="pointer-events-none select-none object-contain"
              priority
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              {countdown !== null && gameState.phase === 'waiting' && (
                <div className="animate-pulse text-base font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
                  Starting in {countdown}s...
                </div>
              )}
              {gameState.phase === 'waiting' && countdown === null && (
                <div className="text-sm text-gray-100 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">Waiting for players...</div>
              )}
              {gameState.phase !== 'waiting' && (
                <CommunityCards
                  cards={gameState.community}
                  phase={gameState.phase}
                  pot={gameState.pot}
                  backImage={deckBackImage}
                />
              )}
            </div>
          </div>

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

          {observers.length > 0 && (
            <div className="absolute right-1 top-1/2 z-20 hidden min-w-[110px] -translate-y-1/2 flex-col gap-1 sm:flex">
              <div className="mb-0.5 text-center text-[10px] uppercase tracking-wide text-gray-600">Watching</div>
              {observers.map((obs) => (
                <div
                  key={obs.playerId}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${theme.sidePanelClass}`}
                >
                  <AvatarDisplay avatarId={obs.avatar ?? 'avatar_m1'} size="sm" />
                  <div>
                    <div className="max-w-[72px] truncate text-[11px] font-semibold text-white">{obs.username}</div>
                    <div className="text-[10px] text-yellow-500">{obs.stack.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {observers.length > 0 && (
            <div className="absolute inset-x-3 bottom-2 z-20 flex gap-2 overflow-x-auto pb-1 sm:hidden">
              {observers.map((obs) => (
                <div
                  key={obs.playerId}
                  className={`flex min-w-[116px] items-center gap-2 rounded-xl border px-2 py-1.5 ${theme.sidePanelClass}`}
                >
                  <AvatarDisplay avatarId={obs.avatar ?? 'avatar_m1'} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-semibold text-white">{obs.username}</div>
                    <div className="text-[10px] text-yellow-500">{obs.stack.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      <div className={`z-20 flex min-h-[76px] shrink-0 items-center justify-center gap-3 px-3 py-3 md:gap-4 md:px-4 ${theme.actionBarClass}`}>
        {gameState.myHandRank && gameState.phase !== 'waiting' && (
          <div className="hidden text-center sm:block">
            <div className="text-xs font-bold uppercase tracking-wide text-yellow-400">{gameState.myHandRank}</div>
            <div className="text-xs text-gray-600">your hand</div>
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
            <span className="text-sm text-gray-500">Watching the game</span>
            {canSitInNow && (
              <button
                onClick={onSitIn}
                className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-yellow-400"
              >
                Sit Down
              </button>
            )}
          </div>
        ) : gameState.phase !== 'waiting' ? (
          <p className="text-sm text-gray-500">
            Waiting for <span className="text-white">{gameState.players.find((p) => p.isCurrentTurn)?.username ?? '...'}</span> to act
          </p>
        ) : (
          <p className="text-sm text-gray-600">Waiting for players to join...</p>
        )}
      </div>

      <div className="absolute bottom-24 left-4 z-10 hidden w-72 2xl:block">
        <ActionLog logs={actionLogs} />
      </div>

      <div className="absolute bottom-24 right-4 z-10 hidden w-80 2xl:block">
        <ChatBox messages={messages} onSend={onChat} myPlayerId={gameState.myPlayerId} hasVipEmojis={hasVipEmojis} />
      </div>

      <div className="absolute bottom-24 right-4 z-10 hidden w-64 flex-col gap-2 lg:flex 2xl:hidden">
        <ActionLog logs={actionLogs} />
        <ChatBox messages={messages} onSend={onChat} myPlayerId={gameState.myPlayerId} hasVipEmojis={hasVipEmojis} />
      </div>

      <div className="absolute bottom-24 right-3 z-20 lg:hidden">
        {showMobilePanel ? (
          <div className="w-[min(22rem,calc(100vw-1rem))] space-y-2">
            <ActionLog logs={actionLogs} />
            <ChatBox messages={messages} onSend={onChat} myPlayerId={gameState.myPlayerId} hasVipEmojis={hasVipEmojis} />
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setShowMobilePanel((value) => !value)}
          className="ml-auto mt-2 flex min-w-[4.5rem] items-center justify-center rounded-full bg-gray-900/95 px-4 py-2 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10"
          aria-expanded={showMobilePanel}
          aria-label={showMobilePanel ? 'Hide chat panel' : 'Show chat panel'}
        >
          {showMobilePanel ? 'Close' : 'Chat'}
        </button>
      </div>

      {handResult && (
        <HandResultModal
          result={handResult}
          onClose={clearHandResult}
          backImage={deckBackImage}
          canTipDealer={canTipDealer}
          dealerTipStack={me?.stack ?? 0}
          onTipDealer={onTipDealer}
        />
      )}
      {isAdmin && (
        <TableBuzzer
          open={showBuzzer}
          onClose={() => setShowBuzzer(false)}
          room={buzzerRoom}
          housePlayers={housePlayers}
          loading={buzzerLoading}
          error={buzzerError}
          message={buzzerMessage}
          actionPlayerId={buzzerActionPlayerId}
          onRefresh={onRefreshBuzzer}
          onSummon={onSummonHousePlayer}
          onDismiss={onDismissHousePlayer}
          onRejuvenate={onRejuvenateHousePlayer}
        />
      )}
    </div>
  )
}

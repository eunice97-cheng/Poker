'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'
import { useGameState } from '@/hooks/useGameState'
import { useAudio } from '@/hooks/useAudio'
import { PokerTable } from '@/components/game/PokerTable'
import { RebuyModal } from '@/components/game/RebuyModal'

interface TablePageClientProps {
  tableId: string
  token: string
  userId: string
  chipBalance: number
}

const AUTO_REBUY_KEY = 'poker_auto_rebuy'

export function TablePageClient({ tableId, token, userId, chipBalance: initialBalance }: TablePageClientProps) {
  const router = useRouter()
  const { socket, connected, error: socketError } = useSocket(token)
  const { playSfx } = useAudio()
  const [leaving, setLeaving] = useState(false)
  const [chipBalance, setChipBalance] = useState(initialBalance)
  const [autoRebuy, setAutoRebuy] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(AUTO_REBUY_KEY) === 'true'
  })

  const {
    gameState,
    handResult,
    messages,
    actionLogs,
    timeLeft,
    countdown,
    bustedInfo,
    clearBusted,
    sendAction,
    sendChat,
    clearHandResult,
  } = useGameState(socket, tableId)

  const handleLeave = useCallback(() => {
    if (!socket || leaving) return
    setLeaving(true)
    playSfx('joinLeave')
    socket.emit('leave_table', {}, () => {
      router.push('/lobby')
    })
  }, [socket, leaving, playSfx, router])

  const handleRebuy = useCallback((amount: number, newAutoRebuy: boolean) => {
    if (!socket) return
    // Persist auto-rebuy preference
    setAutoRebuy(newAutoRebuy)
    localStorage.setItem(AUTO_REBUY_KEY, String(newAutoRebuy))

    clearBusted()
    socket.emit('join_table', { tableId, buyIn: amount }, (res: { error?: string; seat?: number; stack?: number; balance?: number }) => {
      if (res.error) {
        console.error('Rebuy failed:', res.error)
        router.push('/lobby')
        return
      }
      playSfx('joinLeave')
      if (res.balance !== undefined) setChipBalance(res.balance)
    })
  }, [socket, tableId, clearBusted, playSfx, router])

  const handleSitOut = () => {
    playSfx('sitStand')
    socket?.emit('sit_out', {})
  }

  const handleSitIn = () => {
    playSfx('sitStand')
    socket?.emit('sit_in', {})
  }

  // Update chip balance after any cashout/join callback
  useEffect(() => {
    if (!socket) return
    const onLeaveAck = (res: { balance?: number }) => {
      if (res.balance !== undefined) setChipBalance(res.balance)
    }
    socket.on('leave_table', onLeaveAck)
    return () => { socket.off('leave_table', onLeaveAck) }
  }, [socket])

  if (socketError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-center">
        <div>
          <p className="text-red-400 text-xl mb-4">Connection error: {socketError}</p>
          <button onClick={() => router.push('/lobby')} className="text-yellow-400 hover:underline">
            Back to Lobby
          </button>
        </div>
      </div>
    )
  }

  if (!connected || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">{connected ? 'Loading table...' : 'Connecting...'}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <PokerTable
        gameState={gameState}
        handResult={handResult}
        messages={messages}
        actionLogs={actionLogs}
        timeLeft={timeLeft}
        countdown={countdown}
        onAction={sendAction}
        onChat={sendChat}
        onLeave={handleLeave}
        onSitOut={handleSitOut}
        onSitIn={handleSitIn}
        clearHandResult={clearHandResult}
      />
      {bustedInfo && (
        <RebuyModal
          minBuyin={bustedInfo.minBuyin}
          maxBuyin={bustedInfo.maxBuyin}
          chipBalance={chipBalance}
          autoRebuy={autoRebuy}
          onRebuy={handleRebuy}
          onLeave={handleLeave}
        />
      )}
    </>
  )
}

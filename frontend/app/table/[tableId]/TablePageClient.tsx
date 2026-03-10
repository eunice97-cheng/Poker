'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'
import { useGameState } from '@/hooks/useGameState'
import { PokerTable } from '@/components/game/PokerTable'

interface TablePageClientProps {
  tableId: string
  token: string
  userId: string
}

export function TablePageClient({ tableId, token, userId }: TablePageClientProps) {
  const router = useRouter()
  const { socket, connected, error: socketError } = useSocket(token)
  const [leaving, setLeaving] = useState(false)

  const {
    gameState,
    handResult,
    messages,
    timeLeft,
    countdown,
    sendAction,
    sendChat,
    clearHandResult,
  } = useGameState(socket, tableId)

  const handleLeave = () => {
    if (!socket || leaving) return
    setLeaving(true)
    socket.emit('leave_table', {}, () => {
      router.push('/lobby')
    })
  }

  const handleSitOut = () => {
    if (!socket) return
    socket.emit('sit_out', {})
  }

  const handleSitIn = () => {
    if (!socket) return
    socket.emit('sit_in', {})
  }

  // Busted: server removed us from the table
  useEffect(() => {
    if (!socket) return
    const onBusted = () => {
      setTimeout(() => router.push('/lobby'), 3000)
    }
    socket.on('busted', onBusted)
    return () => { socket.off('busted', onBusted) }
  }, [socket, router])

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
    <PokerTable
      gameState={gameState}
      handResult={handResult}
      messages={messages}
      timeLeft={timeLeft}
      countdown={countdown}
      onAction={sendAction}
      onChat={sendChat}
      onLeave={handleLeave}
      onSitOut={handleSitOut}
      onSitIn={handleSitIn}
      clearHandResult={clearHandResult}
    />
  )
}

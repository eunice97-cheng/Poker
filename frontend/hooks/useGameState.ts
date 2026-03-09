'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { GameState, HandResult, ChatMessage, ActionRequired } from '@/types/poker'

export function useGameState(socket: Socket | null, tableId: string) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [handResult, setHandResult] = useState<HandResult | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [actionRequired, setActionRequired] = useState<ActionRequired | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)

  useEffect(() => {
    if (!socket) return

    const onGameState = (state: GameState) => {
      setGameState(state)
      setHandResult(null)
    }

    const onHandResult = (result: HandResult) => {
      setHandResult(result)
      setActionRequired(null)
    }

    const onActionRequired = (data: ActionRequired) => {
      setActionRequired(data)
      setTimeLeft(data.timeLimit)
    }

    const onChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-99), msg])
    }

    const onGameStarting = (data: { countdown: number }) => {
      setCountdown(data.countdown)
    }

    socket.on('game_state', onGameState)
    socket.on('hand_result', onHandResult)
    socket.on('action_required', onActionRequired)
    socket.on('chat_message', onChatMessage)
    socket.on('game_starting', onGameStarting)

    // Try to reconnect to table if already in it
    socket.emit('reconnect_to_table', { tableId })

    return () => {
      socket.off('game_state', onGameState)
      socket.off('hand_result', onHandResult)
      socket.off('action_required', onActionRequired)
      socket.off('chat_message', onChatMessage)
      socket.off('game_starting', onGameStarting)
    }
  }, [socket, tableId])

  // Action timer countdown
  useEffect(() => {
    if (!actionRequired) return
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [actionRequired])

  const sendAction = useCallback(
    (action: string, amount?: number) => {
      if (!socket) return
      socket.emit('player_action', { action, amount })
      setActionRequired(null)
    },
    [socket]
  )

  const sendChat = useCallback(
    (text: string) => {
      if (!socket || !text.trim()) return
      socket.emit('chat_message', { text: text.trim() })
    },
    [socket]
  )

  return {
    gameState,
    handResult,
    messages,
    actionRequired,
    countdown,
    timeLeft,
    sendAction,
    sendChat,
    clearHandResult: () => setHandResult(null),
  }
}

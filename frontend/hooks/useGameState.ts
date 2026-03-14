'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { GameState, HandResult, ChatMessage, ActionRequired } from '@/types/poker'
import { hasIntentionalTableExit } from '@/lib/table-exit'

export interface BustedInfo {
  message: string
  minBuyin: number
  maxBuyin: number
  tableId: string
}

export function useGameState(socket: Socket | null, tableId: string) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [handResult, setHandResult] = useState<HandResult | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [actionLogs, setActionLogs] = useState<string[]>([])
  const [actionRequired, setActionRequired] = useState<ActionRequired | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [bustedInfo, setBustedInfo] = useState<BustedInfo | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)

  useEffect(() => {
    if (!socket) return

    if (hasIntentionalTableExit(tableId)) {
      setTableError('You already left this table. Rejoin it from the lobby if you want back in.')
      return
    }

    setTableError(null)
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

    const clearReconnectTimeout = () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
        reconnectTimeout = null
      }
    }

    const onGameState = (state: GameState) => {
      clearReconnectTimeout()
      setTableError(null)
      setGameState(state)
      if (state.phase !== 'waiting' || state.players.length < 2) {
        setCountdown(null)
      }
      // Only clear hand result when a new hand is in progress (not showdown)
      if (state.phase !== 'showdown') setHandResult(null)
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

    const onActionLog = (data: { message: string }) => {
      setActionLogs((prev) => [...prev.slice(-49), data.message])
    }

    const onGameStarting = (data: { countdown: number }) => {
      setCountdown(data.countdown)
    }

    const onBusted = (data: BustedInfo) => {
      setBustedInfo(data)
    }

    socket.on('game_state', onGameState)
    socket.on('hand_result', onHandResult)
    socket.on('action_required', onActionRequired)
    socket.on('chat_message', onChatMessage)
    socket.on('action_log', onActionLog)
    socket.on('game_starting', onGameStarting)
    socket.on('busted', onBusted)

    // Try to reconnect to table if already in it
    reconnectTimeout = setTimeout(() => {
      setTableError('This table did not wake up in time. Please head back to the lobby and try again.')
    }, 20000)

    socket.emit('reconnect_to_table', { tableId }, (res?: { ok?: boolean; error?: string }) => {
      clearReconnectTimeout()
      if (res?.error) {
        if (res.error === 'Table not found') {
          setTableError('This table no longer exists. The server likely went to sleep and cleared the room.')
          return
        }

        setTableError(res.error)
      }
    })

    return () => {
      clearReconnectTimeout()
      socket.off('game_state', onGameState)
      socket.off('hand_result', onHandResult)
      socket.off('action_required', onActionRequired)
      socket.off('chat_message', onChatMessage)
      socket.off('action_log', onActionLog)
      socket.off('game_starting', onGameStarting)
      socket.off('busted', onBusted)
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

  useEffect(() => {
    if (countdown === null) return
    const timeout = setTimeout(() => {
      setCountdown((current) => {
        if (current === null) return null
        return current > 1 ? current - 1 : 1
      })
    }, 1000)

    return () => clearTimeout(timeout)
  }, [countdown])

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
    actionLogs,
    actionRequired,
    countdown,
    timeLeft,
    bustedInfo,
    tableError,
    clearBusted: () => setBustedInfo(null),
    sendAction,
    sendChat,
    clearHandResult: () => setHandResult(null),
  }
}

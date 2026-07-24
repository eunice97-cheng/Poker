'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { BlackjackAction, BlackjackChatMessage, BlackjackState } from '@/types/blackjack'

export interface BlackjackBustedInfo {
  message: string
  minBuyin: number
  maxBuyin: number
  tableId: string
}

type AckResponse = {
  ok?: boolean
  error?: string
  balance?: number
  stack?: number
  bet?: number
  insuranceBet?: number
}

export function useBlackjackState(socket: Socket | null, tableId: string) {
  const [blackjackState, setBlackjackState] = useState<BlackjackState | null>(null)
  const [messages, setMessages] = useState<BlackjackChatMessage[]>([])
  const [actionLogs, setActionLogs] = useState<string[]>([])
  const [bustedInfo, setBustedInfo] = useState<BlackjackBustedInfo | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const [lastError, setLastError] = useState('')

  useEffect(() => {
    if (!socket) return

    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    const clearReconnectTimeout = () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
        reconnectTimeout = null
      }
    }

    const onState = (state: BlackjackState) => {
      clearReconnectTimeout()
      setTableError(null)
      setBlackjackState(state)
    }

    const onChatMessage = (message: BlackjackChatMessage) => {
      setMessages((prev) => [...prev.slice(-99), message])
    }

    const onActionLog = (data: { message: string }) => {
      setActionLogs((prev) => [...prev.slice(-49), data.message])
    }

    const onBusted = (data: BlackjackBustedInfo) => {
      setBustedInfo(data)
    }

    socket.on('blackjack_state', onState)
    socket.on('blackjack_chat_message', onChatMessage)
    socket.on('blackjack_action_log', onActionLog)
    socket.on('blackjack_busted', onBusted)

    reconnectTimeout = setTimeout(() => {
      setTableError('This blackjack table did not wake up in time. Please head back to the lounge and try again.')
    }, 20000)

    socket.emit('blackjack_reconnect_to_table', { tableId }, (res?: AckResponse) => {
      clearReconnectTimeout()
      if (res?.error) setTableError(res.error)
    })

    return () => {
      clearReconnectTimeout()
      socket.off('blackjack_state', onState)
      socket.off('blackjack_chat_message', onChatMessage)
      socket.off('blackjack_action_log', onActionLog)
      socket.off('blackjack_busted', onBusted)
    }
  }, [socket, tableId])

  const emitAck = useCallback((event: string, payload: unknown = {}) => {
    return new Promise<AckResponse>((resolve) => {
      if (!socket) {
        const response = { error: 'Not connected' }
        setLastError(response.error)
        resolve(response)
        return
      }

      let settled = false
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        const response = { error: 'No response from blackjack table' }
        setLastError(response.error)
        resolve(response)
      }, 8000)

      socket.emit(event, payload, (res?: AckResponse) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        const response = res ?? { error: 'No response from blackjack table' }
        setLastError(response.error ?? '')
        resolve(response)
      })
    })
  }, [socket])

  const placeBet = useCallback((amount: number) => emitAck('blackjack_place_bet', { amount }), [emitAck])
  const clearBet = useCallback(() => emitAck('blackjack_clear_bet'), [emitAck])
  const buyInsurance = useCallback(() => emitAck('blackjack_insurance'), [emitAck])
  const newRound = useCallback(() => emitAck('blackjack_new_round'), [emitAck])
  const rebuy = useCallback((amount: number) => emitAck('blackjack_rebuy', { amount }), [emitAck])
  const tipDealer = useCallback(
    (amount: number, dealerId: string, dealerName: string) => emitAck('blackjack_tip_dealer', { amount, dealerId, dealerName }),
    [emitAck]
  )
  const sitOut = useCallback(() => emitAck('blackjack_sit_out'), [emitAck])
  const sitIn = useCallback((seat?: number) => emitAck('blackjack_sit_in', { seat }), [emitAck])
  const sendAction = useCallback((action: BlackjackAction) => emitAck('blackjack_action', { action }), [emitAck])
  const sendChat = useCallback((text: string) => {
    if (!text.trim()) return Promise.resolve({ error: 'Message cannot be empty' })
    return emitAck('blackjack_chat_message', { text: text.trim() })
  }, [emitAck])

  return {
    blackjackState,
    messages,
    actionLogs,
    bustedInfo,
    tableError,
    lastError,
    clearBusted: () => setBustedInfo(null),
    clearLastError: () => setLastError(''),
    placeBet,
    clearBet,
    buyInsurance,
    newRound,
    rebuy,
    tipDealer,
    sitOut,
    sitIn,
    sendAction,
    sendChat,
  }
}

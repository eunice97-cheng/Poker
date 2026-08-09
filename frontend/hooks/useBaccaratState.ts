'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { BaccaratBetKey, BaccaratChatMessage, BaccaratState } from '@/types/baccarat'

type AckResponse = {
  ok?: boolean
  error?: string
  balance?: number
  stack?: number
  bets?: Record<string, number>
  cashout?: number
}

export function useBaccaratState(socket: Socket | null, tableId: string) {
  const [baccaratState, setBaccaratState] = useState<BaccaratState | null>(null)
  const [messages, setMessages] = useState<BaccaratChatMessage[]>([])
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

    const onState = (state: BaccaratState) => {
      clearReconnectTimeout()
      setTableError(null)
      setBaccaratState(state)
    }

    const onChatMessage = (message: BaccaratChatMessage) => {
      setMessages((prev) => [...prev.slice(-99), message])
    }

    socket.on('baccarat_state', onState)
    socket.on('baccarat_chat_message', onChatMessage)

    reconnectTimeout = setTimeout(() => {
      setTableError('This Baccarat table did not wake up in time. Please head back to the lounge and try again.')
    }, 20000)

    socket.emit('baccarat_reconnect_to_table', { tableId }, (res?: AckResponse) => {
      clearReconnectTimeout()
      if (res?.error) setTableError(res.error)
    })

    return () => {
      clearReconnectTimeout()
      socket.off('baccarat_state', onState)
      socket.off('baccarat_chat_message', onChatMessage)
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
        const response = { error: 'No response from Baccarat table' }
        setLastError(response.error)
        resolve(response)
      }, 8000)

      socket.emit(event, payload, (res?: AckResponse) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        const response = res ?? { error: 'No response from Baccarat table' }
        setLastError(response.error ?? '')
        resolve(response)
      })
    })
  }, [socket])

  const placeBet = useCallback((spot: BaccaratBetKey, amount: number) => emitAck('baccarat_place_bet', { spot, amount }), [emitAck])
  const clearBets = useCallback(() => emitAck('baccarat_clear_bets'), [emitAck])
  const rebet = useCallback(() => emitAck('baccarat_rebet'), [emitAck])
  const doubleBets = useCallback(() => emitAck('baccarat_double_bets'), [emitAck])
  const sitOut = useCallback(() => emitAck('baccarat_sit_out'), [emitAck])
  const sitIn = useCallback((seat?: number) => emitAck('baccarat_sit_in', { seat }), [emitAck])
  const rebuy = useCallback((amount: number) => emitAck('baccarat_rebuy', { amount }), [emitAck])
  const tipDealer = useCallback((amount: number, dealerId: string) => emitAck('baccarat_tip_dealer', { amount, dealerId }), [emitAck])
  const leaveTable = useCallback(() => emitAck('baccarat_leave_table', { tableId }), [emitAck, tableId])
  const sendChat = useCallback((text: string) => {
    if (!text.trim()) return Promise.resolve({ error: 'Message cannot be empty' })
    return emitAck('baccarat_chat_message', { text: text.trim() })
  }, [emitAck])

  return {
    baccaratState,
    messages,
    tableError,
    lastError,
    clearLastError: () => setLastError(''),
    placeBet,
    clearBets,
    rebet,
    doubleBets,
    sitOut,
    sitIn,
    rebuy,
    tipDealer,
    leaveTable,
    sendChat,
  }
}

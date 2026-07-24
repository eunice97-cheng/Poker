import { Server } from 'socket.io'
import { randomUUID } from 'crypto'
import { AuthenticatedSocket } from '../middleware/authMiddleware'
import { blackjackRoomManager } from '../rooms/BlackjackRoomManager'
import { BlackjackRoom } from '../rooms/BlackjackRoom'
import { BlackjackAction, BlackjackServerObserver, BlackjackServerPlayer } from '../types/blackjack'
import { supabaseService } from '../services/supabaseService'
import { sanitizeChatText } from '../utils/chatEmojis'
import { isLocalOnlyTable, LOCAL_ADMIN_ID } from '../utils/localAdmin'

const DEFAULT_MIN_BET = 10
const DEFAULT_MAX_BET = 5000
const DEFAULT_MIN_BUYIN = 1000
const DEFAULT_MAX_BUYIN = 20000
const DEFAULT_MAX_PLAYERS = 7
const pendingBlackjackLeaves = new Set<string>()

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.floor(number)))
}

function createObserver(
  socket: AuthenticatedSocket,
  profile: { avatar?: string | null },
  stack: number,
  hasTableEntry = false
): BlackjackServerObserver {
  return {
    socketId: socket.id,
    playerId: socket.userId,
    username: socket.username,
    avatar: profile.avatar ?? socket.avatar ?? 'avatar_m1',
    stack,
    hasTableEntry,
  }
}

async function deleteRoomIfEmpty(io: Server, room: BlackjackRoom) {
  if (room.shouldKeepAlive()) return

  if (!isLocalOnlyTable(room.tableId)) {
    await supabaseService.deleteTable(room.tableId).catch(console.error)
  }
  blackjackRoomManager.deleteRoom(room.tableId)
  io.emit('blackjack_table_deleted', { tableId: room.tableId })
}

async function cashOutBlackjackChips(room: BlackjackRoom, playerId: string, cashout: number) {
  if (isLocalOnlyTable(room.tableId)) return 100000
  if (cashout <= 0) return undefined

  return supabaseService.addChips(playerId, room.tableId, cashout, 'cashout')
}

function cashoutForPlayer(room: BlackjackRoom, player: BlackjackServerPlayer) {
  return room.state.phase === 'betting' ? player.stack + player.bet : player.stack
}

export function registerBlackjackHandlers(io: Server, socket: AuthenticatedSocket) {
  socket.on('blackjack_create_table', async (params: {
    name?: string
    maxPlayers?: number
    minBet?: number
    maxBet?: number
    minBuyin?: number
    maxBuyin?: number
    buyIn?: number
  }, callback) => {
    let tableId = ''
    let deducted = 0

    try {
      const existingRoom = blackjackRoomManager.getRoomByPlayerId(socket.userId)
      if (existingRoom) return callback?.({ error: 'You are already at a blackjack table' })

      const minBet = clampInteger(params.minBet, DEFAULT_MIN_BET, 10, 1000)
      const maxBet = clampInteger(params.maxBet, DEFAULT_MAX_BET, minBet, 100000)
      const minBuyin = clampInteger(params.minBuyin, DEFAULT_MIN_BUYIN, minBet, 1000000)
      const maxBuyin = clampInteger(params.maxBuyin, DEFAULT_MAX_BUYIN, minBuyin, 1000000)
      const maxPlayers = clampInteger(params.maxPlayers, DEFAULT_MAX_PLAYERS, 2, 7)
      const buyIn = clampInteger(params.buyIn, minBuyin, minBuyin, maxBuyin)

      if (socket.userId === LOCAL_ADMIN_ID) {
        const tableInfo = {
          id: `local_bj_${randomUUID()}`,
          name: params.name?.trim().slice(0, 40) || 'Local Admin Blackjack',
          hostId: socket.userId,
          gameType: 'blackjack' as const,
          maxPlayers,
          smallBlind: minBet,
          bigBlind: maxBet,
          minBuyin,
          maxBuyin,
          status: 'waiting' as const,
          playerCount: 0,
        }

        const room = blackjackRoomManager.createRoom(tableInfo)
        room.addObserver(createObserver(socket, { avatar: socket.avatar ?? 'avatar_m1' }, buyIn, false))
        io.emit('blackjack_table_created', room.getSnapshot())
        callback?.({ tableId: tableInfo.id, observer: true, stack: buyIn, balance: 100000 - buyIn })
        return
      }

      const profile = await supabaseService.getProfile(socket.userId)
      if (profile.chip_balance < buyIn) {
        return callback?.({ error: 'Insufficient chips for buy-in' })
      }

      const tableInfo = await supabaseService.createTable({
        name: params.name?.trim().slice(0, 40) || `${socket.username}'s Blackjack`,
        hostId: socket.userId,
        gameType: 'blackjack',
        maxPlayers,
        smallBlind: minBet,
        bigBlind: maxBet,
        minBuyin,
        maxBuyin,
      })
      tableId = tableInfo.id

      const balance = await supabaseService.deductChips(socket.userId, tableInfo.id, buyIn)
      deducted = buyIn

      const room = blackjackRoomManager.createRoom(tableInfo)
      room.addObserver(createObserver(socket, profile, buyIn, false))

      io.emit('blackjack_table_created', room.getSnapshot())
      callback?.({ tableId: tableInfo.id, observer: true, stack: buyIn, balance })
    } catch (error) {
      console.error('blackjack_create_table error:', error)
      if (deducted > 0 && tableId) {
        await supabaseService.addChips(socket.userId, tableId, deducted, 'refund').catch(console.error)
      }
      if (tableId) {
        await supabaseService.deleteTable(tableId).catch(console.error)
      }
      callback?.({ error: 'Failed to create blackjack table' })
    }
  })

  socket.on('blackjack_join_table', async (params: { tableId: string; buyIn?: number }, callback) => {
    let deducted = 0

    try {
      const existingRoom = blackjackRoomManager.getRoomByPlayerId(socket.userId)
      if (existingRoom) return callback?.({ error: 'You are already at a blackjack table' })

      const room = blackjackRoomManager.getRoom(params.tableId)
      if (!room) return callback?.({ error: 'Blackjack table not found' })
      if (room.hasPlayer(socket.userId)) return callback?.({ error: 'Already at this blackjack table' })
      if (room.hasObserver(socket.userId)) return callback?.({ error: 'Already waiting at this blackjack table' })

      const buyIn = clampInteger(params.buyIn, room.state.minBuyin, room.state.minBuyin, room.state.maxBuyin)
      const profile = socket.userId === LOCAL_ADMIN_ID
        ? { chip_balance: 100000, avatar: socket.avatar ?? 'avatar_m1' }
        : await supabaseService.getProfile(socket.userId)
      if (profile.chip_balance < buyIn) {
        return callback?.({ error: 'Insufficient chips for buy-in' })
      }

      const balance = socket.userId === LOCAL_ADMIN_ID
        ? 100000 - buyIn
        : await supabaseService.deductChips(socket.userId, room.tableId, buyIn)
      deducted = socket.userId === LOCAL_ADMIN_ID ? 0 : buyIn

      room.addObserver(createObserver(socket, profile, buyIn, false))
      callback?.({ observer: true, stack: buyIn, balance })
    } catch (error) {
      console.error('blackjack_join_table error:', error)
      if (deducted > 0) {
        await supabaseService.addChips(socket.userId, params.tableId, deducted, 'refund').catch(console.error)
      }
      callback?.({ error: 'Failed to join blackjack table' })
    }
  })

  socket.on('blackjack_reconnect_to_table', (params: { tableId: string }, callback) => {
    const room = blackjackRoomManager.getRoom(params.tableId)
    if (!room) return callback?.({ error: 'Blackjack table not found' })

    const ok = room.reconnectPlayer(socket.userId, socket.id)
    if (!ok) {
      const observerOk = room.reconnectObserver(socket.userId, socket.id)
      if (!observerOk) return callback?.({ error: 'Not at this blackjack table' })
      callback?.({ ok: true, observer: true })
      return
    }

    callback?.({ ok: true })
  })

  socket.on('blackjack_leave_table', async (params: { tableId?: string } = {}, callback) => {
    let leaveKey = ''

    try {
      const room = blackjackRoomManager.getRoomBySocketId(socket.id) ??
        (params.tableId ? blackjackRoomManager.getRoom(params.tableId) : null) ??
        blackjackRoomManager.getRoomByPlayerId(socket.userId)
      if (!room) return callback?.({ error: 'Not at a blackjack table' })

      leaveKey = `${room.tableId}:${socket.userId}`
      if (pendingBlackjackLeaves.has(leaveKey)) {
        return callback?.({ error: 'Cash out is already in progress' })
      }
      pendingBlackjackLeaves.add(leaveKey)

      const observer = room.getObserverBySocketId(socket.id) ?? room.getObserverByPlayerId(socket.userId)
      if (observer) {
        const cashout = observer.stack
        let balance: number | undefined

        if (isLocalOnlyTable(room.tableId)) {
          balance = 100000
        } else {
          balance = await cashOutBlackjackChips(room, observer.playerId, cashout)
          if (observer.hasTableEntry) {
            await supabaseService.removeTablePlayer(room.tableId, observer.playerId)
          }
        }

        room.removeObserver(observer.playerId)
        await deleteRoomIfEmpty(io, room)
        callback?.({ cashout, balance })
        return
      }

      const player = room.getPlayerBySocketId(socket.id) ?? room.getPlayerByPlayerId(socket.userId)
      if (!player) return callback?.({ error: 'Player not found' })

      const cashout = cashoutForPlayer(room, player)
      const balance = await cashOutBlackjackChips(room, player.playerId, cashout)
      if (!isLocalOnlyTable(room.tableId)) {
        await supabaseService.removeTablePlayer(room.tableId, player.playerId)
      }

      const removed = await room.removePlayer(player)
      await deleteRoomIfEmpty(io, room)
      callback?.({ cashout: removed.cashout, balance })
    } catch (error) {
      console.error('blackjack_leave_table error:', error)
      callback?.({ error: 'Cashout failed. Your table chips were kept at the table.' })
    } finally {
      if (leaveKey) pendingBlackjackLeaves.delete(leaveKey)
    }
  })

  socket.on('blackjack_sit_out', (_: unknown, callback) => {
    const room = blackjackRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a blackjack table' })

    const res = room.standPlayerUp(socket.id)
    if (res.error || !res.observer) return callback?.(res)

    if (!isLocalOnlyTable(room.tableId)) {
      supabaseService.updateTablePlayerStack(room.tableId, res.observer.playerId, res.observer.stack).catch(console.error)
    }

    callback?.({ ok: true, stack: res.observer.stack })
  })

  socket.on('blackjack_sit_in', (params: { seat?: number }, callback) => {
    const room = blackjackRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a blackjack table' })

    const res = room.seatObserver(socket.id, Number(params?.seat))
    if (res.error || !res.player || !res.observer) return callback?.(res)

    if (!isLocalOnlyTable(room.tableId)) {
      if (res.observer.hasTableEntry) {
        supabaseService.updateTablePlayerSeat(room.tableId, res.player.playerId, res.seat).catch(console.error)
      } else {
        supabaseService.addTablePlayer(room.tableId, res.player.playerId, res.seat, res.player.stack).catch(console.error)
      }
    }

    callback?.({ ok: true, seat: res.seat, stack: res.player.stack })
  })

  socket.on('blackjack_place_bet', (params: { amount: number }, callback) => {
    const room = blackjackRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a blackjack table' })
    callback?.(room.placeBet(socket.id, Number(params.amount)))
  })

  socket.on('blackjack_clear_bet', (_: unknown, callback) => {
    const room = blackjackRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a blackjack table' })
    callback?.(room.clearBet(socket.id))
  })

  socket.on('blackjack_deal', async (_: unknown, callback) => {
    callback?.({ error: 'Dealer starts automatically after the betting countdown' })
  })

  socket.on('blackjack_action', async (params: { action: BlackjackAction }, callback) => {
    const room = blackjackRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a blackjack table' })
    callback?.(await room.handleAction(socket.id, params.action))
  })

  socket.on('blackjack_new_round', async (_: unknown, callback) => {
    const room = blackjackRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a blackjack table' })
    callback?.(await room.newRound(socket.id))
  })

  socket.on('blackjack_rebuy', async (params: { amount: number }, callback) => {
    let deducted = 0

    try {
      const room = blackjackRoomManager.getRoomBySocketId(socket.id)
      if (!room) return callback?.({ error: 'Not at a blackjack table' })

      const amount = clampInteger(params.amount, room.state.minBuyin, room.state.minBuyin, room.state.maxBuyin)

      if (isLocalOnlyTable(room.tableId)) {
        const added = await room.addToStack(socket.userId, amount)
        callback?.({ ...added, balance: 100000 })
        return
      }

      const profile = await supabaseService.getProfile(socket.userId)
      if (profile.chip_balance < amount) {
        return callback?.({ error: 'Insufficient chips for rebuy' })
      }

      const balance = await supabaseService.deductChips(socket.userId, room.tableId, amount)
      deducted = amount
      const added = await room.addToStack(socket.userId, amount)
      if (added.error) throw new Error(added.error)
      callback?.({ ...added, balance })
    } catch (error) {
      console.error('blackjack_rebuy error:', error)
      const room = blackjackRoomManager.getRoomBySocketId(socket.id)
      if (deducted > 0 && room) {
        await supabaseService.addChips(socket.userId, room.tableId, deducted, 'refund').catch(console.error)
      }
      callback?.({ error: 'Failed to rebuy blackjack chips' })
    }
  })

  socket.on('blackjack_chat_message', (data: { text: string }, callback) => {
    const room = blackjackRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a blackjack table' })

    const text = sanitizeChatText(data.text?.trim().slice(0, 200) ?? '', socket.hasVipEmojis)
    if (!text) return callback?.({ error: 'Message cannot be empty' })

    io.to(room.tableId).emit('blackjack_chat_message', {
      playerId: socket.userId,
      username: socket.username,
      avatar: socket.avatar,
      text,
      timestamp: new Date().toISOString(),
    })
    callback?.({ ok: true })
  })
}

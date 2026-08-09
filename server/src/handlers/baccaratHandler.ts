import { Server } from 'socket.io'
import { randomUUID } from 'crypto'
import { AuthenticatedSocket } from '../middleware/authMiddleware'
import { baccaratRoomManager } from '../rooms/BaccaratRoomManager'
import { BaccaratRoom } from '../rooms/BaccaratRoom'
import { BaccaratBetKey, BaccaratServerPlayer } from '../types/baccarat'
import { supabaseService } from '../services/supabaseService'
import { sanitizeChatText } from '../utils/chatEmojis'
import { isHouseTable, isLocalOnlyTable, isMemoryOnlyTable, LOCAL_ADMIN_ID } from '../utils/localAdmin'

const DEFAULT_MIN_BET = 100
const DEFAULT_MAX_BET = 10000
const DEFAULT_MIN_BUYIN = 100
const DEFAULT_MAX_BUYIN = 100000
const DEFAULT_MAX_PLAYERS = 6
const DEALER_TIP_AMOUNT = 100
const pendingBaccaratLeaves = new Set<string>()

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.floor(number)))
}

function createPlayer(
  socket: AuthenticatedSocket,
  profile: { avatar?: string | null },
  stack: number,
  hasTableEntry = false
) {
  return {
    socketId: socket.id,
    playerId: socket.userId,
    username: socket.username,
    avatar: profile.avatar ?? socket.avatar ?? 'avatar_m1',
    stack,
    hasTableEntry,
  }
}

async function deleteRoomIfEmpty(io: Server, room: BaccaratRoom) {
  if (room.shouldKeepAlive()) return

  if (!isMemoryOnlyTable(room.tableId)) {
    await supabaseService.deleteTable(room.tableId).catch(console.error)
  }
  baccaratRoomManager.deleteRoom(room.tableId)
  io.emit('baccarat_table_deleted', { tableId: room.tableId })
}

async function cashOutBaccaratChips(room: BaccaratRoom, playerId: string, cashout: number) {
  if (isLocalOnlyTable(room.tableId)) return 100000
  if (cashout <= 0) return undefined

  return supabaseService.addChips(playerId, isHouseTable(room.tableId) ? null : room.tableId, cashout, 'cashout')
}

function tableReferenceId(room: BaccaratRoom) {
  return isHouseTable(room.tableId) ? null : room.tableId
}

function normalizeDealerId(value: unknown) {
  const dealerId = String(value ?? 'chloe')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 40)
  return dealerId || 'chloe'
}

function getBuyInRange(params: { maxBet?: number; minBuyin?: number; maxBuyin?: number }) {
  const minBuyin = clampInteger(params.minBuyin, DEFAULT_MIN_BUYIN, DEFAULT_MIN_BUYIN, 1000000)
  const maxBuyin = clampInteger(params.maxBuyin, Math.max(DEFAULT_MAX_BUYIN, Number(params.maxBet ?? DEFAULT_MAX_BET) * 10), minBuyin, 1000000)
  return { minBuyin, maxBuyin }
}

export function registerBaccaratHandlers(io: Server, socket: AuthenticatedSocket) {
  socket.on('baccarat_create_table', async (params: {
    name?: string
    maxPlayers?: number
    maxBet?: number
    minBuyin?: number
    maxBuyin?: number
    buyIn?: number
  }, callback) => {
    let tableId = ''
    let deducted = 0

    try {
      const existingRoom = baccaratRoomManager.getRoomByPlayerId(socket.userId)
      if (existingRoom) return callback?.({ error: 'You are already at a Baccarat table' })

      const minBet = DEFAULT_MIN_BET
      const maxBet = clampInteger(params.maxBet, DEFAULT_MAX_BET, minBet, 10000)
      const { minBuyin, maxBuyin } = getBuyInRange({ maxBet, minBuyin: params.minBuyin, maxBuyin: params.maxBuyin })
      const maxPlayers = clampInteger(params.maxPlayers, DEFAULT_MAX_PLAYERS, 2, 6)
      const buyIn = clampInteger(params.buyIn, minBuyin, minBuyin, maxBuyin)

      if (socket.userId === LOCAL_ADMIN_ID) {
        const tableInfo = {
          id: `local_bac_${randomUUID()}`,
          name: params.name?.trim().slice(0, 40) || 'Local Admin Baccarat',
          hostId: socket.userId,
          gameType: 'baccarat' as const,
          tableKind: 'custom' as const,
          maxPlayers,
          smallBlind: minBet,
          bigBlind: maxBet,
          minBuyin,
          maxBuyin,
          status: 'waiting' as const,
          playerCount: 0,
        }

        const room = baccaratRoomManager.createRoom(tableInfo)
        const seated = room.addPlayer(createPlayer(socket, { avatar: socket.avatar ?? 'avatar_m1' }, buyIn, false))
        if (seated.error) return callback?.(seated)
        io.emit('baccarat_table_created', room.getSnapshot())
        callback?.({ tableId: tableInfo.id, seat: seated.seat, stack: buyIn, balance: 100000 - buyIn })
        return
      }

      const profile = await supabaseService.getProfile(socket.userId)
      if (profile.chip_balance < buyIn) {
        return callback?.({ error: 'Insufficient chips for buy-in' })
      }

      const tableInfo = await supabaseService.createTable({
        name: params.name?.trim().slice(0, 40) || `${socket.username}'s Baccarat`,
        hostId: socket.userId,
        gameType: 'baccarat',
        maxPlayers,
        smallBlind: minBet,
        bigBlind: maxBet,
        minBuyin,
        maxBuyin,
      })
      tableId = tableInfo.id

      const balance = await supabaseService.deductChips(socket.userId, tableInfo.id, buyIn)
      deducted = buyIn

      const room = baccaratRoomManager.createRoom({ ...tableInfo, tableKind: 'custom' })
      const seated = room.addPlayer(createPlayer(socket, profile, buyIn, true))
      if (seated.error || !seated.player) throw new Error(seated.error ?? 'Failed to seat player')
      supabaseService.addTablePlayer(room.tableId, socket.userId, seated.seat ?? 0, buyIn).catch(console.error)

      io.emit('baccarat_table_created', room.getSnapshot())
      callback?.({ tableId: tableInfo.id, seat: seated.seat, stack: buyIn, balance })
    } catch (error) {
      console.error('baccarat_create_table error:', error)
      if (deducted > 0 && tableId) {
        await supabaseService.addChips(socket.userId, tableId, deducted, 'refund').catch(console.error)
      }
      if (tableId) {
        await supabaseService.deleteTable(tableId).catch(console.error)
      }
      callback?.({ error: 'Failed to create Baccarat table' })
    }
  })

  socket.on('baccarat_join_table', async (params: { tableId: string; buyIn?: number }, callback) => {
    let deducted = 0
    let room: BaccaratRoom | null = null

    try {
      const existingRoom = baccaratRoomManager.getRoomByPlayerId(socket.userId)
      if (existingRoom) return callback?.({ error: 'You are already at a Baccarat table' })

      room = baccaratRoomManager.getRoom(params.tableId)
      if (!room) return callback?.({ error: 'Baccarat table not found' })
      if (room.hasPlayer(socket.userId)) return callback?.({ error: 'Already seated at this Baccarat table' })
      if (room.hasObserver(socket.userId)) return callback?.({ error: 'Already waiting at this Baccarat table' })
      if (room.isFull()) {
        if (room.state.tableKind !== 'house') return callback?.({ error: 'Baccarat table is full' })
        room = baccaratRoomManager.ensureOpenHouseTable()
        io.emit('baccarat_table_created', room.getSnapshot())
      }

      const buyIn = clampInteger(params.buyIn, room.state.minBuyin, room.state.minBuyin, room.state.maxBuyin)
      const profile = socket.userId === LOCAL_ADMIN_ID
        ? { chip_balance: 100000, avatar: socket.avatar ?? 'avatar_m1' }
        : await supabaseService.getProfile(socket.userId)
      if (profile.chip_balance < buyIn) {
        return callback?.({ error: 'Insufficient chips for buy-in' })
      }

      const balance = socket.userId === LOCAL_ADMIN_ID
        ? 100000 - buyIn
        : await supabaseService.deductChips(socket.userId, tableReferenceId(room), buyIn)
      deducted = socket.userId === LOCAL_ADMIN_ID ? 0 : buyIn

      const seated = room.addPlayer(createPlayer(socket, profile, buyIn, !isMemoryOnlyTable(room.tableId)))
      if (seated.error || !seated.player) throw new Error(seated.error ?? 'Failed to seat player')
      if (!isMemoryOnlyTable(room.tableId)) {
        supabaseService.addTablePlayer(room.tableId, socket.userId, seated.seat ?? 0, buyIn).catch(console.error)
      }
      io.emit('baccarat_table_updated', room.getSnapshot())
      callback?.({ tableId: room.tableId, seat: seated.seat, stack: buyIn, balance })
    } catch (error) {
      console.error('baccarat_join_table error:', error)
      if (deducted > 0) {
        await supabaseService.addChips(socket.userId, room ? tableReferenceId(room) : null, deducted, 'refund').catch(console.error)
      }
      callback?.({ error: 'Failed to join Baccarat table' })
    }
  })

  socket.on('baccarat_reconnect_to_table', (params: { tableId: string }, callback) => {
    const room = baccaratRoomManager.getRoom(params.tableId)
    if (!room) return callback?.({ error: 'Baccarat table not found' })

    const ok = room.reconnectPlayer(socket.userId, socket.id)
    if (!ok) return callback?.({ error: 'Not at this Baccarat table' })
    callback?.({ ok: true })
  })

  socket.on('baccarat_leave_table', async (params: { tableId?: string } = {}, callback) => {
    let leaveKey = ''

    try {
      const room = baccaratRoomManager.getRoomBySocketId(socket.id) ??
        (params.tableId ? baccaratRoomManager.getRoom(params.tableId) : null) ??
        baccaratRoomManager.getRoomByPlayerId(socket.userId)
      if (!room) return callback?.({ error: 'Not at a Baccarat table' })

      leaveKey = `${room.tableId}:${socket.userId}`
      if (pendingBaccaratLeaves.has(leaveKey)) {
        return callback?.({ error: 'Cash out is already in progress' })
      }
      pendingBaccaratLeaves.add(leaveKey)

      const observer = room.getObserverBySocketId(socket.id) ?? room.getObserverByPlayerId(socket.userId)
      if (observer) {
        const cashout = observer.stack
        const balance = await cashOutBaccaratChips(room, observer.playerId, cashout)
        if (!isMemoryOnlyTable(room.tableId) && observer.hasTableEntry) {
          await supabaseService.removeTablePlayer(room.tableId, observer.playerId)
        }
        room.removeObserver(observer.playerId)
        await deleteRoomIfEmpty(io, room)
        callback?.({ cashout, balance })
        return
      }

      const player = room.getPlayerBySocketId(socket.id) ?? room.getPlayerByPlayerId(socket.userId)
      if (!player) return callback?.({ error: 'Player not found' })
      if (room.isRoundLocked()) return callback?.({ error: 'Please wait for this Baccarat round to finish' })

      const removed = await room.removePlayer(player)
      const balance = await cashOutBaccaratChips(room, player.playerId, removed.cashout)
      if (!isMemoryOnlyTable(room.tableId)) {
        await supabaseService.removeTablePlayer(room.tableId, player.playerId)
      }
      await deleteRoomIfEmpty(io, room)
      callback?.({ cashout: removed.cashout, balance })
    } catch (error) {
      console.error('baccarat_leave_table error:', error)
      callback?.({ error: 'Cashout failed. Your table chips were kept at the table.' })
    } finally {
      if (leaveKey) pendingBaccaratLeaves.delete(leaveKey)
    }
  })

  socket.on('baccarat_sit_out', (_: unknown, callback) => {
    const room = baccaratRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a Baccarat table' })
    const res = room.standPlayerUp(socket.id)
    if (res.error || !res.observer) return callback?.(res)
    if (!isMemoryOnlyTable(room.tableId)) {
      supabaseService.updateTablePlayerStack(room.tableId, res.observer.playerId, res.observer.stack).catch(console.error)
    }
    callback?.({ ok: true, stack: res.observer.stack })
  })

  socket.on('baccarat_sit_in', (params: { seat?: number }, callback) => {
    const room = baccaratRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a Baccarat table' })
    const res = room.seatObserver(socket.id, Number(params?.seat))
    if ('error' in res || !res.player || !res.observer) return callback?.(res)
    if (!isMemoryOnlyTable(room.tableId)) {
      if (res.observer.hasTableEntry) {
        supabaseService.updateTablePlayerSeat(room.tableId, res.player.playerId, res.seat ?? 0).catch(console.error)
      } else {
        supabaseService.addTablePlayer(room.tableId, res.player.playerId, res.seat ?? 0, res.player.stack).catch(console.error)
      }
    }
    callback?.({ ok: true, seat: res.seat, stack: res.player.stack })
  })

  socket.on('baccarat_place_bet', (params: { spot: BaccaratBetKey; amount: number }, callback) => {
    const room = baccaratRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a Baccarat table' })
    callback?.(room.placeBet(socket.id, params.spot, Number(params.amount)))
  })

  socket.on('baccarat_clear_bets', (_: unknown, callback) => {
    const room = baccaratRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a Baccarat table' })
    callback?.(room.clearBets(socket.id))
  })

  socket.on('baccarat_rebet', (_: unknown, callback) => {
    const room = baccaratRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a Baccarat table' })
    callback?.(room.rebet(socket.id))
  })

  socket.on('baccarat_double_bets', (_: unknown, callback) => {
    const room = baccaratRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a Baccarat table' })
    callback?.(room.doubleBets(socket.id))
  })

  socket.on('baccarat_tip_dealer', (params: { amount?: number; dealerId?: string }, callback) => {
    const room = baccaratRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a Baccarat table' })
    callback?.(room.tipDealer(socket.id, normalizeDealerId(params?.dealerId), Number(params?.amount ?? DEALER_TIP_AMOUNT)))
  })

  socket.on('baccarat_rebuy', async (params: { amount: number }, callback) => {
    let deducted = 0

    try {
      const room = baccaratRoomManager.getRoomBySocketId(socket.id)
      if (!room) return callback?.({ error: 'Not at a Baccarat table' })

      const amount = clampInteger(params.amount, room.state.minBuyin, room.state.minBuyin, room.state.maxBuyin)
      if (isLocalOnlyTable(room.tableId)) {
        const added = room.addToStack(socket.userId, amount)
        callback?.({ ...added, balance: 100000 })
        return
      }

      const profile = await supabaseService.getProfile(socket.userId)
      if (profile.chip_balance < amount) {
        return callback?.({ error: 'Insufficient chips for rebuy' })
      }

      const balance = await supabaseService.deductChips(socket.userId, tableReferenceId(room), amount)
      deducted = amount
      const added = room.addToStack(socket.userId, amount)
      if (added.error) throw new Error(added.error)
      callback?.({ ...added, balance })
    } catch (error) {
      console.error('baccarat_rebuy error:', error)
      const room = baccaratRoomManager.getRoomBySocketId(socket.id)
      if (deducted > 0 && room) {
        await supabaseService.addChips(socket.userId, tableReferenceId(room), deducted, 'refund').catch(console.error)
      }
      callback?.({ error: 'Failed to rebuy Baccarat chips' })
    }
  })

  socket.on('baccarat_chat_message', (data: { text: string }, callback) => {
    const room = baccaratRoomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a Baccarat table' })

    const text = sanitizeChatText(data.text?.trim().slice(0, 200) ?? '', socket.hasVipEmojis)
    if (!text) return callback?.({ error: 'Message cannot be empty' })

    io.to(room.tableId).emit('baccarat_chat_message', {
      playerId: socket.userId,
      username: socket.username,
      avatar: socket.avatar,
      text,
      timestamp: new Date().toISOString(),
    })
    callback?.({ ok: true })
  })
}

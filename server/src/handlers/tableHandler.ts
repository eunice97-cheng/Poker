import { AuthenticatedSocket } from '../middleware/authMiddleware'
import { roomManager } from '../rooms/RoomManager'
import { supabaseService } from '../services/supabaseService'
import { ServerObserver, ServerPlayer } from '../types/game'
import { Server } from 'socket.io'
import { getHouseExitLine, releaseHousePlayer } from '../ai/housePlayers'

export function registerTableHandlers(io: Server, socket: AuthenticatedSocket) {
  // Create a new table
  socket.on('create_table', async (params: {
    name: string
    maxPlayers?: number
    smallBlind?: number
    bigBlind?: number
    minBuyin?: number
    maxBuyin?: number
    buyIn: number
  }, callback) => {
    try {
      const profile = await supabaseService.getProfile(socket.userId)
      const bigBlind = params.bigBlind ?? 20
      const smallBlind = params.smallBlind ?? bigBlind / 2
      const minBuyin = params.minBuyin ?? bigBlind * 20
      const maxBuyin = params.maxBuyin ?? bigBlind * 100
      const buyIn = Math.max(minBuyin, Math.min(maxBuyin, params.buyIn))

      if (profile.chip_balance < buyIn) {
        return callback?.({ error: 'Insufficient chips for buy-in' })
      }

      const tableInfo = await supabaseService.createTable({
        name: params.name || `${socket.username}'s Table`,
        hostId: socket.userId,
        maxPlayers: params.maxPlayers ?? 6,
        smallBlind,
        bigBlind,
        minBuyin,
        maxBuyin,
      })

      const room = roomManager.createRoom(tableInfo)

      // Deduct buy-in from profile and add to table
      const balanceAfter = await supabaseService.deductChips(socket.userId, tableInfo.id, buyIn)
      await supabaseService.addTablePlayer(tableInfo.id, socket.userId, 0, buyIn)

      const player: ServerPlayer = {
        socketId: socket.id,
        playerId: socket.userId,
        username: socket.username,
        avatar: profile.avatar ?? 'avatar_m1',
        seat: 0,
        stack: buyIn,
        holeCards: [],
        currentBet: 0,
        totalBetThisHand: 0,
        folded: false,
        allIn: false,
        sittingOut: false,
        hasActed: false,
        isConnected: true,
        isBot: false,
        standUpAfterHand: false,
      }

      room.addPlayer(player)
      room.engine.broadcastGameState()
      io.to(tableInfo.id).emit('action_log', { message: `${socket.username} joined the game` })

      io.emit('table_created', { tableId: tableInfo.id })
      callback?.({ tableId: tableInfo.id, seat: 0, stack: buyIn, balance: balanceAfter })
    } catch (err) {
      console.error('create_table error:', err)
      callback?.({ error: 'Failed to create table' })
    }
  })

  // Join an existing table
  socket.on('join_table', async (params: { tableId: string; buyIn: number }, callback) => {
    let room = null as ReturnType<typeof roomManager.getRoom>
    try {
      const { tableId, buyIn } = params
      room = roomManager.getRoom(tableId)
      if (!room) return callback?.({ error: 'Table not found' })
      if (room.hasPendingJoin(socket.userId)) return callback?.({ error: 'Join already in progress' })
      room.beginPendingJoin(socket.userId)
      const aiOpponent = Array.from(room.state.players.values()).find((player) => player.isBot)
      const handInProgress = room.state.phase !== 'waiting'
      const shouldQueueBehindAi = !!aiOpponent && room.getRealPlayerCount() === 1 && handInProgress

      if (room.isFull() && !shouldQueueBehindAi) {
        const waitingBot = room.state.phase === 'waiting'
          ? Array.from(room.state.players.values()).find((player) => player.isBot)
          : null
        if (waitingBot) {
          room.removePlayer(waitingBot.socketId)
          releaseHousePlayer(waitingBot, 'normal')
          io.to(tableId).emit('action_log', { message: getHouseExitLine(waitingBot.playerId, 'guest') ?? `${waitingBot.username} leaves a seat for a guest` })
        } else {
          return callback?.({ error: 'Table is full' })
        }
      }
      if (room.hasPlayer(socket.userId)) return callback?.({ error: 'Already at this table' })

      const { minBuyin, maxBuyin } = room.state
      const actualBuyIn = Math.max(minBuyin, Math.min(maxBuyin, buyIn))

      const profile = await supabaseService.getProfile(socket.userId)
      if (profile.chip_balance < actualBuyIn) {
        return callback?.({ error: 'Insufficient chips for buy-in' })
      }

      const balanceAfter = await supabaseService.deductChips(socket.userId, tableId, actualBuyIn)

      if (handInProgress) {
        const observer: ServerObserver = {
          socketId: socket.id,
          playerId: socket.userId,
          username: socket.username,
          avatar: profile.avatar ?? 'avatar_m1',
          stack: actualBuyIn,
          hasTableEntry: false,
        }

        room.addObserver(observer)
        io.to(tableId).emit('action_log', { message: `${socket.username} takes a rail seat until this hand finishes` })

        if (shouldQueueBehindAi && aiOpponent && !aiOpponent.botLeaveAfterHand) {
          aiOpponent.botLeaveAfterHand = true
          io.to(tableId).emit('action_log', { message: `${aiOpponent.username} will leave after this hand` })
        }

        room.engine.broadcastGameState()
        callback?.({ observer: true, stack: actualBuyIn, balance: balanceAfter })
        return
      }

      const seat = room.findEmptySeat()
      if (seat === null) return callback?.({ error: 'No seats available' })

      await supabaseService.addTablePlayer(tableId, socket.userId, seat, actualBuyIn)

      const player: ServerPlayer = {
        socketId: socket.id,
        playerId: socket.userId,
        username: socket.username,
        avatar: profile.avatar ?? 'avatar_m1',
        seat,
        stack: actualBuyIn,
        holeCards: [],
        currentBet: 0,
        totalBetThisHand: 0,
        folded: false,
        allIn: false,
        sittingOut: false,
        hasActed: false,
        isConnected: true,
        isBot: false,
        standUpAfterHand: false,
      }

      room.addPlayer(player)
      io.to(tableId).emit('action_log', { message: `${socket.username} joined the game` })

      const houseAi = Array.from(room.state.players.values()).find((tablePlayer) => tablePlayer.isBot)
      if (houseAi && room.getRealPlayerCount() > 1) {
        if (room.state.phase === 'waiting') {
          room.removePlayer(houseAi.socketId)
          releaseHousePlayer(houseAi, 'normal')
          io.to(tableId).emit('action_log', { message: getHouseExitLine(houseAi.playerId, 'guest') ?? `${houseAi.username} leaves the table for the real players` })
        } else {
          houseAi.botLeaveAfterHand = true
          io.to(tableId).emit('action_log', { message: `${houseAi.username} will leave after this hand` })
        }
      }

      io.to(tableId).emit('player_joined', {
        playerId: socket.userId,
        username: socket.username,
        seat,
        stack: actualBuyIn,
      })

      room.engine.broadcastGameState()
      callback?.({ seat, stack: actualBuyIn, balance: balanceAfter })
    } catch (err) {
      console.error('join_table error:', err)
      callback?.({ error: 'Failed to join table' })
    } finally {
      room?.endPendingJoin(socket.userId)
    }
  })

  // Leave table and cash out
  socket.on('leave_table', async (_, callback) => {
    try {
      const room = roomManager.getRoomBySocketId(socket.id)
      if (!room) return callback?.({ error: 'Not at a table' })

      // Handle observer leaving
      const observer = room.getObserverBySocketId(socket.id)
      if (observer) {
        room.removeObserver(observer.playerId)
        const cashout = observer.stack
        io.to(room.tableId).emit('action_log', { message: `${observer.username} left the room` })
        room.engine.broadcastGameState()
        if (cashout > 0) {
          const balanceAfter = await supabaseService.addChips(socket.userId, room.tableId, cashout, 'cashout')
          if (observer.hasTableEntry) {
            await supabaseService.removeTablePlayer(room.tableId, socket.userId)
          }
          callback?.({ cashout, balance: balanceAfter })
        } else {
          if (observer.hasTableEntry) {
            await supabaseService.removeTablePlayer(room.tableId, socket.userId)
          }
          callback?.({ cashout: 0 })
        }
        if (!room.shouldKeepAlive()) {
          await supabaseService.deleteTable(room.tableId)
          roomManager.deleteRoom(room.tableId)
        }
        return
      }

      // Handle seated player leaving
      const player = room.getPlayerBySocketId(socket.id)
      if (!player) return callback?.({ error: 'Player not found' })

      const cashout = player.stack + player.currentBet
      room.removePlayer(socket.id)

      io.to(room.tableId).emit('action_log', { message: `${player.username} left the room` })
      io.to(room.tableId).emit('player_left', {
        playerId: player.playerId,
        username: player.username,
        reason: 'left',
      })

      room.engine.broadcastGameState()

      if (cashout > 0) {
        const balanceAfter = await supabaseService.addChips(socket.userId, room.tableId, cashout, 'cashout')
        await supabaseService.removeTablePlayer(room.tableId, socket.userId)
        callback?.({ cashout, balance: balanceAfter })
      } else {
        await supabaseService.removeTablePlayer(room.tableId, socket.userId)
        callback?.({ cashout: 0 })
      }

      if (!room.shouldKeepAlive()) {
        await supabaseService.deleteTable(room.tableId)
        roomManager.deleteRoom(room.tableId)
      }
    } catch (err) {
      console.error('leave_table error:', err)
      callback?.({ error: 'Failed to leave table' })
    }
  })

  // Dev Mode: create table with bots for testing
  socket.on('create_dev_table', async (params: { buyIn: number }, callback) => {
    callback?.({ error: 'Dev Mode is disabled during beta' })
  })

  // Chat
  socket.on('chat_message', (data: { text: string }) => {
    const room = roomManager.getRoomBySocketId(socket.id)
    if (!room) return
    const text = data.text?.trim().slice(0, 200)
    if (!text) return
    io.to(room.tableId).emit('chat_message', {
      playerId: socket.userId,
      username: socket.username,
      text,
      timestamp: new Date().toISOString(),
    })
  })
}

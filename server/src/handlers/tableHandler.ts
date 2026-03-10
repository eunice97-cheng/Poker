import { AuthenticatedSocket } from '../middleware/authMiddleware'
import { roomManager } from '../rooms/RoomManager'
import { supabaseService } from '../services/supabaseService'
import { ServerPlayer } from '../types/game'
import { Server } from 'socket.io'

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
    try {
      const { tableId, buyIn } = params
      const room = roomManager.getRoom(tableId)
      if (!room) return callback?.({ error: 'Table not found' })
      if (room.isFull()) return callback?.({ error: 'Table is full' })
      if (room.hasPlayer(socket.userId)) return callback?.({ error: 'Already at this table' })

      const { minBuyin, maxBuyin } = room.state
      const actualBuyIn = Math.max(minBuyin, Math.min(maxBuyin, buyIn))

      const profile = await supabaseService.getProfile(socket.userId)
      if (profile.chip_balance < actualBuyIn) {
        return callback?.({ error: 'Insufficient chips for buy-in' })
      }

      const seat = room.findEmptySeat()
      if (seat === null) return callback?.({ error: 'No seats available' })

      const balanceAfter = await supabaseService.deductChips(socket.userId, tableId, actualBuyIn)
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
      }

      room.addPlayer(player)
      io.to(tableId).emit('action_log', { message: `${socket.username} joined the game` })

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
          await supabaseService.removeTablePlayer(room.tableId, socket.userId)
          callback?.({ cashout, balance: balanceAfter })
        } else {
          await supabaseService.removeTablePlayer(room.tableId, socket.userId)
          callback?.({ cashout: 0 })
        }
        const realPlayers = Array.from(room.state.players.values()).filter(p => !p.isBot)
        const hasObservers = room.state.observers.size > 0
        if (realPlayers.length === 0 && !hasObservers) {
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

      const realPlayers = Array.from(room.state.players.values()).filter(p => !p.isBot)
      const hasObservers = room.state.observers.size > 0
      if (realPlayers.length === 0 && !hasObservers) {
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
    try {
      const profile = await supabaseService.getProfile(socket.userId)
      const buyIn = Math.max(200, params.buyIn ?? 1000)

      if (profile.chip_balance < buyIn) {
        return callback?.({ error: 'Insufficient chips for buy-in' })
      }

      const tableInfo = await supabaseService.createTable({
        name: `${socket.username}'s Dev Table`,
        hostId: socket.userId,
        maxPlayers: 6,
        smallBlind: Math.floor(buyIn / 100),
        bigBlind: Math.floor(buyIn / 50),
        minBuyin: buyIn,
        maxBuyin: buyIn * 10,
      })

      const room = roomManager.createRoom(tableInfo)

      // Deduct buy-in for real player
      await supabaseService.deductChips(socket.userId, tableInfo.id, buyIn)
      await supabaseService.addTablePlayer(tableInfo.id, socket.userId, 0, buyIn)

      // Real player
      const realPlayer: ServerPlayer = {
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
      }
      room.addPlayer(realPlayer)

      // Add 3 bots
      const botNames = ['Bot_Alice', 'Bot_Bob', 'Bot_Charlie']
      for (let i = 0; i < 3; i++) {
        const botPlayer: ServerPlayer = {
          socketId: `bot_${tableInfo.id}_${i}`,
          playerId: `bot-player-${i}`,
          username: botNames[i],
          avatar: 'avatar_m1',
          seat: i + 1,
          stack: buyIn,
          holeCards: [],
          currentBet: 0,
          totalBetThisHand: 0,
          folded: false,
          allIn: false,
          sittingOut: false,
          hasActed: false,
          isConnected: true,
          isBot: true,
        }
        room.addBotPlayer(botPlayer)
      }

      // Start immediately
      room.state.status = 'playing'
      setTimeout(() => room.engine.startHand().catch(console.error), 1000)

      io.emit('table_created', { tableId: tableInfo.id })
      callback?.({ tableId: tableInfo.id })
    } catch (err) {
      console.error('create_dev_table error:', err)
      callback?.({ error: 'Failed to create dev table' })
    }
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

import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { isAdminEmail } from '../utils/admin'
import { roomManager } from '../rooms/RoomManager'
import { getHouseRestingSummary } from '../ai/housePlayers'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function verifyAdminToken(authorizationHeader?: string | null) {
  const token = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length).trim()
    : ''

  if (!token) {
    return { ok: false as const, status: 401, error: 'Missing bearer token' }
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false as const, status: 401, error: 'Invalid or expired token' }
  }

  if (!isAdminEmail(data.user.email)) {
    return { ok: false as const, status: 403, error: 'GM access required' }
  }

  return { ok: true as const, user: data.user }
}

function serializeRoom(room: ReturnType<typeof roomManager.getAllRooms>[number]) {
  const currentBots = room.getHousePlayers()
  const liveHousePlayers = getHouseRestingSummary()
  const canAnswerBuzzer = liveHousePlayers.some(
    (player) => player.assignedTableId === null && player.isReady && player.bankroll >= room.state.minBuyin
  )
  const isBetweenHands = room.state.phase === 'waiting' || room.state.phase === 'showdown'

  return {
    tableId: room.tableId,
    tableName: room.state.tableName,
    phase: room.state.phase,
    status: room.state.status,
    playerCount: room.getPlayerCount(),
    realPlayerCount: room.getRealPlayerCount(),
    botPlayerCount: room.getBotPlayerCount(),
    maxPlayers: room.state.maxPlayers,
    smallBlind: room.state.smallBlind,
    bigBlind: room.state.bigBlind,
    minBuyin: room.state.minBuyin,
    maxBuyin: room.state.maxBuyin,
    houseJoinSuppressed: room.isHouseJoinSuppressed(),
    currentHousePlayers: currentBots.map((bot) => ({
      playerId: bot.playerId,
      username: bot.username,
      avatar: bot.avatar,
      botTitle: bot.botTitle ?? null,
      leaveAfterHand: Boolean(bot.botLeaveAfterHand),
      botMode: bot.botMode ?? 'auto',
    })),
    currentHousePlayer: currentBots[0]
      ? {
          playerId: currentBots[0].playerId,
          username: currentBots[0].username,
          avatar: currentBots[0].avatar,
          botTitle: currentBots[0].botTitle ?? null,
          leaveAfterHand: Boolean(currentBots[0].botLeaveAfterHand),
          botMode: currentBots[0].botMode ?? 'auto',
        }
      : null,
    canSummon: isBetweenHands
      && room.getRealPlayerCount() >= 1
      && room.findEmptySeat() !== null
      && canAnswerBuzzer,
    canDismiss: currentBots.length > 0,
  }
}

router.get('/', async (req, res) => {
  const auth = await verifyAdminToken(req.header('authorization'))
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  const rooms = roomManager
    .getAllRooms()
    .map(serializeRoom)
    .sort((a, b) => a.tableName.localeCompare(b.tableName))

  res.json({
    rooms,
    housePlayers: getHouseRestingSummary(),
    generatedAt: new Date().toISOString(),
  })
})

router.post('/', async (req, res) => {
  const auth = await verifyAdminToken(req.header('authorization'))
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  const tableId = String(req.body?.tableId ?? '').trim()
  const action = String(req.body?.action ?? '').trim()
  const housePlayerId = String(req.body?.housePlayerId ?? '').trim() || undefined

  if (!tableId) {
    res.status(400).json({ error: 'tableId is required' })
    return
  }

  if (action !== 'summon' && action !== 'dismiss') {
    res.status(400).json({ error: 'action must be summon or dismiss' })
    return
  }

  const room = roomManager.getRoom(tableId)
  if (!room) {
    res.status(404).json({ error: 'Live table not found' })
    return
  }

  const result = action === 'summon'
    ? room.summonHousePlayerByBuzzer(housePlayerId)
    : room.dismissHousePlayerByBuzzer(housePlayerId)

  if (!result.ok) {
    res.status(400).json(result)
    return
  }

  res.json({
    ...result,
    rooms: roomManager
      .getAllRooms()
      .map(serializeRoom)
      .sort((a, b) => a.tableName.localeCompare(b.tableName)),
    room: serializeRoom(room),
    housePlayers: getHouseRestingSummary(),
  })
})

export default router

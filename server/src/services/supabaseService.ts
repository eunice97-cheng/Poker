import { createClient } from '@supabase/supabase-js'
import { ServerGameState, ServerPlayer, TableInfo } from '../types/game'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // service key bypasses RLS — server only!
)

export const supabaseService = {
  // ─── Tables ────────────────────────────────────────────────────────────

  async createTable(params: {
    name: string
    hostId: string
    maxPlayers: number
    smallBlind: number
    bigBlind: number
    minBuyin: number
    maxBuyin: number
  }): Promise<TableInfo> {
    const { data, error } = await supabase
      .from('tables')
      .insert({
        name: params.name,
        host_id: params.hostId,
        max_players: params.maxPlayers,
        small_blind: params.smallBlind,
        big_blind: params.bigBlind,
        min_buyin: params.minBuyin,
        max_buyin: params.maxBuyin,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create table: ${error.message}`)

    return {
      id: data.id,
      name: data.name,
      hostId: data.host_id,
      maxPlayers: data.max_players,
      smallBlind: data.small_blind,
      bigBlind: data.big_blind,
      minBuyin: data.min_buyin,
      maxBuyin: data.max_buyin,
      status: data.status,
      playerCount: data.player_count,
    }
  },

  async updateTableStatus(tableId: string, status: string, playerCount: number) {
    await supabase
      .from('tables')
      .update({ status, player_count: playerCount })
      .eq('id', tableId)
  },

  async listTables() {
    const { data, error } = await supabase
      .from('tables')
      .select('id, status, player_count')

    if (error) throw new Error(`Failed to list tables: ${error.message}`)
    return data ?? []
  },

  async deleteTable(tableId: string) {
    await supabase.from('tables').delete().eq('id', tableId)
  },

  // ─── Chip Management ───────────────────────────────────────────────────

  async deductChips(playerId: string, tableId: string, amount: number): Promise<number> {
    // Atomic: subtract chips and return new balance
    const { data, error } = await supabase.rpc('deduct_chips', {
      p_player_id: playerId,
      p_table_id: tableId,
      p_amount: amount,
    })
    if (error) throw new Error(`Failed to deduct chips: ${error.message}`)
    return data as number
  },

  async addChips(playerId: string, tableId: string, amount: number, type: string = 'cashout'): Promise<number> {
    const { data, error } = await supabase.rpc('add_chips', {
      p_player_id: playerId,
      p_table_id: tableId,
      p_amount: amount,
      p_type: type,
    })
    if (error) throw new Error(`Failed to add chips: ${error.message}`)
    return data as number
  },

  async updateChipBalances(players: ServerPlayer[], tableId: string) {
    const humanPlayers = players.filter((p) => !p.isBot)
    if (humanPlayers.length === 0) return
    // Update each player's stack in table_players (in-game stack)
    const updates = humanPlayers.map((p) =>
      supabase
        .from('table_players')
        .update({ stack: p.stack })
        .eq('table_id', tableId)
        .eq('player_id', p.playerId)
    )
    await Promise.all(updates)
  },

  // ─── Table Players ─────────────────────────────────────────────────────

  async addTablePlayer(tableId: string, playerId: string, seat: number, stack: number) {
    await supabase.from('table_players').insert({
      table_id: tableId,
      player_id: playerId,
      seat,
      stack,
    })
    // Update player count
    const { count } = await supabase
      .from('table_players')
      .select('*', { count: 'exact', head: true })
      .eq('table_id', tableId)
    await supabase.from('tables').update({ player_count: count ?? 0 }).eq('id', tableId)
  },

  async removeTablePlayer(tableId: string, playerId: string) {
    await supabase
      .from('table_players')
      .delete()
      .eq('table_id', tableId)
      .eq('player_id', playerId)
    const { count } = await supabase
      .from('table_players')
      .select('*', { count: 'exact', head: true })
      .eq('table_id', tableId)
    await supabase.from('tables').update({ player_count: count ?? 0 }).eq('id', tableId)
  },

  async updateTablePlayerSeat(tableId: string, playerId: string, seat: number) {
    await supabase
      .from('table_players')
      .update({ seat })
      .eq('table_id', tableId)
      .eq('player_id', playerId)
  },

  async updateTablePlayerStack(tableId: string, playerId: string, stack: number) {
    await supabase
      .from('table_players')
      .update({ stack })
      .eq('table_id', tableId)
      .eq('player_id', playerId)
  },

  // ─── Hand History ──────────────────────────────────────────────────────

  async recordHand(
    state: ServerGameState,
    winners: { playerId: string; username: string; amount: number; handRank: string; holeCards: string[] }[],
    allHoleCards: { playerId: string; username: string; holeCards: string[] }[]
  ) {
    const playerSnapshot = Array.from(state.players.values()).map((p) => ({
      player_id: p.playerId,
      username: p.username,
      hole_cards: p.holeCards,
      stack: p.stack,
      is_bot: p.isBot,
    }))

    await supabase.from('hand_history').insert({
      table_id: state.tableId,
      hand_number: state.handNumber,
      community: state.community,
      pot_total: state.pot,
      winners: winners,
      players: playerSnapshot,
      started_at: state.handStartedAt ?? new Date(),
    })

    // Update games_played and games_won
    const winnerIds = winners
      .map((w) => w.playerId)
      .filter((playerId) => !playerId.startsWith('ai_'))
    const allPlayerIds = Array.from(state.players.values())
      .filter((p) => !p.isBot)
      .map((p) => p.playerId)

    if (allPlayerIds.length > 0) {
      await supabase.rpc('increment_games_played', { player_ids: allPlayerIds })
    }
    if (winnerIds.length > 0) {
      await supabase.rpc('increment_games_won', { player_ids: winnerIds })
    }
  },

  // ─── Cleanup ────────────────────────────────────────────────────────────

  async cleanupDevTables() {
    // On server start, purge any dev tables left over from previous sessions
    await supabase.from('tables').delete().ilike('name', '%Dev Table%')
  },

  async cleanupOrphanedTables() {
    // Delete empty tables that have been abandoned for a while after crashes/disconnects.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    await supabase
      .from('tables')
      .delete()
      .eq('player_count', 0)
      .lt('created_at', fiveMinutesAgo)
  },

  // ─── Daily Chip Recovery ───────────────────────────────────────────────

  async recoverAbandonedTables() {
    const { data, error } = await supabase.rpc('recover_abandoned_tables')
    if (error) throw new Error(`Failed to recover abandoned tables: ${error.message}`)

    const result = Array.isArray(data) ? data[0] : data
    return {
      recoveredTables: Number(result?.recovered_tables ?? 0),
      refundedPlayers: Number(result?.refunded_players ?? 0),
      refundedChips: Number(result?.refunded_chips ?? 0),
    }
  },

  async markPlayerBroke(playerId: string) {
    // Sets broke_at = now() if the player has 0 chips and isn't already marked
    await supabase.rpc('mark_player_broke', { p_player_id: playerId })
  },

  async awardDailyChips() {
    // Awards 2,000 chips to players who have been broke for 24+ hours
    const { data, error } = await supabase.rpc('award_daily_chips')
    if (error) { console.error('[DailyChips] Error:', error.message); return }
    if (data && data.length > 0) {
      for (const row of data) {
        console.log(`[DailyChips] Awarded 2000 chips to ${row.player_id} (balance: ${row.new_balance})`)
      }
    }
  },

  // ─── Profile ───────────────────────────────────────────────────────────

  async getProfile(playerId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', playerId)
      .single()
    if (error) throw error
    return data
  },
}

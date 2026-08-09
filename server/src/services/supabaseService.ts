import { createClient } from '@supabase/supabase-js'
import { ServerGameState, ServerPlayer, TableInfo } from '../types/game'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // service key bypasses RLS — server only!
)

type BlackjackDealerTipRow = {
  dealer_id: string
  total_tips: number | string
}

function dealerTipsMap(rows: BlackjackDealerTipRow[] | null | undefined) {
  const tips: Record<string, number> = {}
  for (const row of rows ?? []) {
    tips[row.dealer_id] = Number(row.total_tips) || 0
  }
  return tips
}

function assertPositiveChipAmount(amount: number, operation: string) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`${operation} amount must be a positive integer`)
  }
}

export const supabaseService = {
  // ─── Tables ────────────────────────────────────────────────────────────

  async createTable(params: {
    name: string
    hostId: string
    gameType?: 'poker' | 'blackjack' | 'baccarat'
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
        game_type: params.gameType ?? 'poker',
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
      gameType: data.game_type ?? 'poker',
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
    const { error } = await supabase
      .from('tables')
      .update({ status, player_count: playerCount })
      .eq('id', tableId)
    if (error) throw new Error(`Failed to update table status: ${error.message}`)
  },

  async listTables() {
    const { data, error } = await supabase
      .from('tables')
      .select('id, status, player_count')

    if (error) throw new Error(`Failed to list tables: ${error.message}`)
    return data ?? []
  },

  async deleteTable(tableId: string) {
    const { error } = await supabase.from('tables').delete().eq('id', tableId)
    if (error) throw new Error(`Failed to delete table: ${error.message}`)
  },

  // ─── Chip Management ───────────────────────────────────────────────────

  async deductChips(playerId: string, tableId: string | null, amount: number): Promise<number> {
    assertPositiveChipAmount(amount, 'Chip deduction')

    // Atomic: subtract chips and return new balance
    const { data, error } = await supabase.rpc('deduct_chips', {
      p_player_id: playerId,
      p_table_id: tableId,
      p_amount: amount,
    })
    if (error) throw new Error(`Failed to deduct chips: ${error.message}`)
    return data as number
  },

  async addChips(playerId: string, tableId: string | null, amount: number, type: string = 'cashout'): Promise<number> {
    assertPositiveChipAmount(amount, 'Chip addition')

    const { data, error } = await supabase.rpc('add_chips', {
      p_player_id: playerId,
      p_table_id: tableId,
      p_amount: amount,
      p_type: type,
    })
    if (error) {
      const message = error.message ?? ''
      const missingTableReference = Boolean(tableId)
        && /transactions_table_id_fkey|foreign key constraint|not present in table "tables"/i.test(message)

      if (missingTableReference) {
        const retry = await supabase.rpc('add_chips', {
          p_player_id: playerId,
          p_table_id: null,
          p_amount: amount,
          p_type: type,
        })
        if (!retry.error) return retry.data as number
      }

      throw new Error(`Failed to add chips: ${message}`)
    }
    return data as number
  },

  async getBlackjackDealerTips(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('blackjack_dealer_tips')
      .select('dealer_id, total_tips')

    if (error) throw new Error(`Failed to load blackjack dealer tips: ${error.message}`)
    return dealerTipsMap(data as BlackjackDealerTipRow[])
  },

  async recordBlackjackDealerTip(dealerId: string, dealerName: string, amount: number): Promise<Record<string, number>> {
    assertPositiveChipAmount(amount, 'Dealer tip')

    const { data, error } = await supabase.rpc('record_blackjack_dealer_tip', {
      p_dealer_id: dealerId,
      p_dealer_name: dealerName,
      p_amount: amount,
    })

    if (error) {
      const { data: existing, error: readError } = await supabase
        .from('blackjack_dealer_tips')
        .select('total_tips, tip_count')
        .eq('dealer_id', dealerId)
        .maybeSingle()

      if (readError && readError.code !== 'PGRST116') {
        throw new Error(`Failed to record blackjack dealer tip: ${error.message}; fallback read failed: ${readError.message}`)
      }

      const totalTips = Number(existing?.total_tips ?? 0) + amount
      const tipCount = Number(existing?.tip_count ?? 0) + 1
      const { error: upsertError } = await supabase
        .from('blackjack_dealer_tips')
        .upsert({
          dealer_id: dealerId,
          dealer_name: dealerName,
          total_tips: totalTips,
          tip_count: tipCount,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'dealer_id' })

      if (upsertError) {
        throw new Error(`Failed to record blackjack dealer tip: ${error.message}; fallback write failed: ${upsertError.message}`)
      }

      return this.getBlackjackDealerTips()
    }
    return dealerTipsMap(data as BlackjackDealerTipRow[])
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
    const results = await Promise.all(updates)
    const failed = results.find((result) => result.error)
    if (failed?.error) throw new Error(`Failed to update chip balances: ${failed.error.message}`)
  },

  // ─── Table Players ─────────────────────────────────────────────────────

  async addTablePlayer(tableId: string, playerId: string, seat: number, stack: number) {
    if (!Number.isInteger(seat) || seat < 0) {
      throw new Error('Seat must be a non-negative integer')
    }
    if (!Number.isSafeInteger(stack) || stack < 0) {
      throw new Error('Stack must be a non-negative integer')
    }

    const { error: insertError } = await supabase.from('table_players').insert({
      table_id: tableId,
      player_id: playerId,
      seat,
      stack,
    })
    if (insertError) throw new Error(`Failed to add table player: ${insertError.message}`)

    // Update player count
    const { count, error: countError } = await supabase
      .from('table_players')
      .select('*', { count: 'exact', head: true })
      .eq('table_id', tableId)
    if (countError) throw new Error(`Failed to count table players: ${countError.message}`)

    const { error: updateError } = await supabase.from('tables').update({ player_count: count ?? 0 }).eq('id', tableId)
    if (updateError) throw new Error(`Failed to update table player count: ${updateError.message}`)
  },

  async removeTablePlayer(tableId: string, playerId: string) {
    const { error: deleteError } = await supabase
      .from('table_players')
      .delete()
      .eq('table_id', tableId)
      .eq('player_id', playerId)
    if (deleteError) throw new Error(`Failed to remove table player: ${deleteError.message}`)

    const { count, error: countError } = await supabase
      .from('table_players')
      .select('*', { count: 'exact', head: true })
      .eq('table_id', tableId)
    if (countError) throw new Error(`Failed to count table players: ${countError.message}`)

    const { error: updateError } = await supabase.from('tables').update({ player_count: count ?? 0 }).eq('id', tableId)
    if (updateError) throw new Error(`Failed to update table player count: ${updateError.message}`)
  },

  async updateTablePlayerSeat(tableId: string, playerId: string, seat: number) {
    if (!Number.isInteger(seat) || seat < 0) {
      throw new Error('Seat must be a non-negative integer')
    }

    const { error } = await supabase
      .from('table_players')
      .update({ seat })
      .eq('table_id', tableId)
      .eq('player_id', playerId)
    if (error) throw new Error(`Failed to update table player seat: ${error.message}`)
  },

  async updateTablePlayerStack(tableId: string, playerId: string, stack: number) {
    if (!Number.isSafeInteger(stack) || stack < 0) {
      throw new Error('Stack must be a non-negative integer')
    }

    const { error } = await supabase
      .from('table_players')
      .update({ stack })
      .eq('table_id', tableId)
      .eq('player_id', playerId)
    if (error) throw new Error(`Failed to update table player stack: ${error.message}`)
  },

  async incrementGamesPlayed(playerIds: string[]) {
    if (playerIds.length === 0) return
    const { error } = await supabase.rpc('increment_games_played', { player_ids: playerIds })
    if (error) throw new Error(`Failed to increment games played: ${error.message}`)
  },

  async incrementGamesWon(playerIds: string[]) {
    if (playerIds.length === 0) return
    const { error } = await supabase.rpc('increment_games_won', { player_ids: playerIds })
    if (error) throw new Error(`Failed to increment games won: ${error.message}`)
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
      total_bet: p.totalBetThisHand,
      folded: p.folded,
      all_in: p.allIn,
      stack_after: p.stack,
      is_bot: p.isBot,
    }))

    const { error } = await supabase.from('hand_history').insert({
      table_id: state.tableId,
      hand_number: state.handNumber,
      community: state.community,
      pot_total: state.pot,
      winners: winners,
      players: playerSnapshot,
      started_at: state.handStartedAt ?? new Date(),
    })
    if (error) {
      console.error(`Failed to record hand: ${error.message}`)
    }

    // Update games_played and games_won
    const winnerIds = winners
      .map((w) => w.playerId)
      .filter((playerId) => !playerId.startsWith('ai_'))
    const allPlayerIds = Array.from(state.players.values())
      .filter((p) => !p.isBot)
      .map((p) => p.playerId)

    if (allPlayerIds.length > 0) {
      await this.incrementGamesPlayed(allPlayerIds)
    }
    if (winnerIds.length > 0) {
      await this.incrementGamesWon(winnerIds)
    }
  },

  // ─── Cleanup ────────────────────────────────────────────────────────────

  async cleanupDevTables() {
    // On server start, purge any dev tables left over from previous sessions
    const { error } = await supabase.from('tables').delete().ilike('name', '%Dev Table%')
    if (error) throw new Error(`Failed to cleanup dev tables: ${error.message}`)
  },

  async cleanupOrphanedTables() {
    // Delete empty tables that have been abandoned for a while after crashes/disconnects.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('player_count', 0)
      .lt('created_at', fiveMinutesAgo)
    if (error) throw new Error(`Failed to cleanup orphaned tables: ${error.message}`)
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

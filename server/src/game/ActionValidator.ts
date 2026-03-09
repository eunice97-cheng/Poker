import { PlayerAction, ServerPlayer, ServerGameState } from '../types/game'

export interface ValidatedAction {
  valid: boolean
  error?: string
  normalizedAmount?: number // for raise: the actual total bet amount
}

export function getValidActions(
  player: ServerPlayer,
  state: ServerGameState
): PlayerAction[] {
  if (player.folded || player.allIn || player.sittingOut) return []

  const toCall = state.currentBetLevel - player.currentBet
  const actions: PlayerAction[] = ['fold']

  if (toCall === 0) {
    actions.push('check')
  } else {
    actions.push('call')
  }

  // Can raise if player has enough chips to at least min-raise
  const minRaiseTotal = state.currentBetLevel + state.lastRaiseAmount
  if (player.stack + player.currentBet > state.currentBetLevel) {
    if (player.stack > toCall) {
      actions.push('raise')
    }
    actions.push('allin')
  }

  return actions
}

export function validateAction(
  player: ServerPlayer,
  action: PlayerAction,
  amount: number | undefined,
  state: ServerGameState
): ValidatedAction {
  const valid = getValidActions(player, state)

  if (!valid.includes(action)) {
    return { valid: false, error: `Action "${action}" is not valid right now` }
  }

  if (action === 'raise') {
    if (amount === undefined || isNaN(amount)) {
      return { valid: false, error: 'Raise requires an amount' }
    }
    const toCall = state.currentBetLevel - player.currentBet
    const minRaiseTotal = state.currentBetLevel + state.lastRaiseAmount
    const maxRaise = player.currentBet + player.stack

    if (amount < minRaiseTotal && amount < maxRaise) {
      return {
        valid: false,
        error: `Minimum raise is ${minRaiseTotal}, got ${amount}`,
      }
    }
    if (amount > maxRaise) {
      return { valid: false, error: 'Cannot raise more than your stack' }
    }
    return { valid: true, normalizedAmount: amount }
  }

  return { valid: true }
}

export function getCallAmount(player: ServerPlayer, state: ServerGameState): number {
  return Math.min(state.currentBetLevel - player.currentBet, player.stack)
}

export function getMinRaise(state: ServerGameState): number {
  return state.currentBetLevel + state.lastRaiseAmount
}

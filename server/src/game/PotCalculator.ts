import { SidePot } from '../types/game'

interface PlayerContribution {
  playerId: string
  totalBet: number
  allIn: boolean
  folded: boolean
}

/**
 * Calculate main pot and side pots from player contributions.
 * Side pots are created when players go all-in for different amounts.
 */
export function calculatePots(players: PlayerContribution[]): SidePot[] {
  const activePlayers = players.filter((p) => !p.folded || p.totalBet > 0)
  if (activePlayers.length === 0) return [{ amount: 0, eligiblePlayerIds: [] }]

  const pots: SidePot[] = []
  let remaining = activePlayers.map((p) => ({ ...p }))

  // Sort by total bet so we process smallest all-ins first
  const allInAmounts = remaining
    .filter((p) => p.allIn && !p.folded)
    .map((p) => p.totalBet)
    .sort((a, b) => a - b)

  // Remove duplicates
  const uniqueAllIns = [...new Set(allInAmounts)]

  let previousCap = 0

  for (const cap of uniqueAllIns) {
    const contribution = cap - previousCap
    const eligible = remaining.filter((p) => !p.folded && p.totalBet >= cap)
    const potAmount = remaining.reduce((sum, p) => {
      const contrib = Math.min(Math.max(p.totalBet - previousCap, 0), contribution)
      return sum + contrib
    }, 0)

    if (potAmount > 0) {
      pots.push({
        amount: potAmount,
        eligiblePlayerIds: eligible.map((p) => p.playerId),
      })
    }
    previousCap = cap
  }

  // Main pot: remaining chips from all players above the last all-in cap
  const mainEligible = remaining.filter((p) => !p.folded && !p.allIn)
  if (mainEligible.length > 0 || pots.length === 0) {
    const mainAmount = remaining.reduce((sum, p) => {
      return sum + Math.max(p.totalBet - previousCap, 0)
    }, 0)
    if (mainAmount > 0) {
      pots.push({
        amount: mainAmount,
        eligiblePlayerIds: [...mainEligible.map((p) => p.playerId), ...remaining.filter(p => p.allIn && p.totalBet >= previousCap && !p.folded).map(p => p.playerId)],
      })
    }
  }

  // If no all-ins, just one pot
  if (pots.length === 0) {
    const total = players.reduce((sum, p) => sum + p.totalBet, 0)
    const eligible = players.filter((p) => !p.folded).map((p) => p.playerId)
    return [{ amount: total, eligiblePlayerIds: eligible }]
  }

  return pots
}

/**
 * Simple single-pot version used mid-hand for display
 */
export function calculateTotalPot(players: PlayerContribution[]): number {
  return players.reduce((sum, p) => sum + p.totalBet, 0)
}

// Uses the pokersolver library for 7-card hand evaluation
// pokersolver expects cards like 'Ah', 'Kd', 'Qc', etc.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Hand } = require('pokersolver')

export interface EvaluatedHand {
  playerId: string
  username: string
  holeCards: string[]
  rank: string        // e.g., "Royal Flush", "Two Pair"
  score: number       // higher = better (for sorting)
  hand: unknown       // pokersolver hand object
}

export function evaluateHands(
  players: { playerId: string; username: string; holeCards: string[] }[],
  community: string[]
): EvaluatedHand[] {
  return players.map((p) => {
    const allCards = [...p.holeCards, ...community]
    const hand = Hand.solve(allCards)
    return {
      playerId: p.playerId,
      username: p.username,
      holeCards: p.holeCards,
      rank: hand.name as string,
      score: hand.rank as number,
      hand,
    }
  })
}

export function findWinners(evaluatedHands: EvaluatedHand[]): EvaluatedHand[] {
  if (evaluatedHands.length === 0) return []
  // pokersolver's Hand.winners handles ties correctly
  const hands = evaluatedHands.map((e) => e.hand)
  const winningHands = Hand.winners(hands) as unknown[]
  return evaluatedHands.filter((e) => winningHands.includes(e.hand))
}

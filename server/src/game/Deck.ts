const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A']
const SUITS = ['h','d','c','s']

export function createShuffledDeck(): string[] {
  const deck: string[] = []
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(`${rank}${suit}`)
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export function dealCards(deck: string[], count: number): { cards: string[]; remaining: string[] } {
  if (deck.length < count) throw new Error('Not enough cards in deck')
  return {
    cards: deck.slice(0, count),
    remaining: deck.slice(count),
  }
}

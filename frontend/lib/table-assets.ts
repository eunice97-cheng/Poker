export function getDealerImage(bigBlind: number) {
  if (bigBlind === 10 || bigBlind === 20) return '/Eunice1.png'
  if (bigBlind === 50 || bigBlind === 100) return '/Eunice2.png'
  if (bigBlind === 200) return '/Eunice3.png'
  if (bigBlind === 500) return '/Eunice4.png'
  return '/Eunice1.png'
}

export function getDeckBackImage(bigBlind: number) {
  if (bigBlind === 10 || bigBlind === 20) return '/decks/Deck1.png'
  if (bigBlind === 50 || bigBlind === 100) return '/decks/Deck2.png'
  if (bigBlind === 200) return '/decks/Deck3.png'
  if (bigBlind === 500) return '/decks/Deck4.png'
  return '/decks/Deck1.png'
}

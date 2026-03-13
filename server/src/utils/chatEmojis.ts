const STANDARD_CHAT_EMOJI_CODES = new Set([
  ':all-in:',
  ':angry:',
  ':beer:',
  ':cash:',
  ':clover:',
  ':coffee:',
  ':cool:',
  ':cry:',
  ':devil:',
  ':flush:',
  ':heart:',
  ':juice:',
  ':lmao1:',
  ':lmao2:',
  ':lol:',
  ':mocktail:',
  ':no:',
  ':pair:',
  ':rofl:',
  ':rolling:',
  ':rolling2:',
])

const VIP_CHAT_EMOJI_CODES = new Set([
  ':1v1:',
  ':champagne:',
  ':choco-milkl:',
  ':cocktail:',
  ':fuck-you:',
  ':gg:',
  ':good-luck:',
  ':mid-fingers:',
  ':milk:',
  ':mojito:',
  ':noob:',
  ':op:',
  ':poison:',
  ':rofl2:',
  ':rolling3:',
  ':rolling4:',
  ':sake:',
  ':shit:',
  ':whisky:',
  ':wine:',
])

export function sanitizeChatText(rawText: string, hasVipAccess: boolean) {
  return rawText
    .replace(/:([a-z0-9-]+):/g, (match) => {
      if (STANDARD_CHAT_EMOJI_CODES.has(match)) return match
      if (VIP_CHAT_EMOJI_CODES.has(match)) {
        return hasVipAccess ? match : ''
      }
      return match
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

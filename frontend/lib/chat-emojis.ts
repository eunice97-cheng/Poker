export interface ChatEmojiDefinition {
  slug: string
  code: string
  src: string
  label: string
  vip: boolean
}

export const STANDARD_CHAT_EMOJI_SLUGS = [
  'all-in',
  'angry',
  'beer',
  'cash',
  'clover',
  'coffee',
  'cool',
  'cry',
  'devil',
  'flush',
  'heart',
  'juice',
  'lmao1',
  'lmao2',
  'lol',
  'mocktail',
  'no',
  'pair',
  'rofl',
  'rolling',
  'rolling2',
] as const

export const VIP_CHAT_EMOJI_SLUGS = [
  '1v1',
  'champagne',
  'choco-milkl',
  'cocktail',
  'fuck-you',
  'gg',
  'good-luck',
  'mid-fingers',
  'milk',
  'mojito',
  'noob',
  'op',
  'poison',
  'rofl2',
  'rolling3',
  'rolling4',
  'sake',
  'shit',
  'whisky',
  'wine',
] as const

function createChatEmoji(slug: string, vip: boolean): ChatEmojiDefinition {
  return {
    slug,
    code: `:${slug}:`,
    src: `${vip ? '/emojis-vip' : '/emojis'}/${slug}.png`,
    label: slug.replace(/-/g, ' '),
    vip,
  }
}

export const STANDARD_CHAT_EMOJIS = STANDARD_CHAT_EMOJI_SLUGS.map((slug) => createChatEmoji(slug, false))
export const VIP_CHAT_EMOJIS = VIP_CHAT_EMOJI_SLUGS.map((slug) => createChatEmoji(slug, true))
export const CHAT_EMOJIS = [...STANDARD_CHAT_EMOJIS, ...VIP_CHAT_EMOJIS]

export const CHAT_EMOJI_MAP = new Map(CHAT_EMOJIS.map((emoji) => [emoji.code, emoji]))

export function appendChatEmojiCode(currentText: string, emojiCode: string, maxLength: number) {
  const spacer = currentText.length > 0 && !/\s$/.test(currentText) ? ' ' : ''
  const nextText = `${currentText}${spacer}${emojiCode} `
  return nextText.length <= maxLength ? nextText : currentText
}

type ChatMessageSegment =
  | { type: 'text'; value: string }
  | { type: 'emoji'; emoji: ChatEmojiDefinition }

export function getChatMessageSegments(text: string): ChatMessageSegment[] {
  const segments: ChatMessageSegment[] = []
  const matcher = /:([a-z0-9-]+):/g
  let cursor = 0

  let match = matcher.exec(text)
  while (match) {
    const rawCode = match[0]
    const emoji = CHAT_EMOJI_MAP.get(rawCode)
    if (!emoji || match.index === undefined) {
      match = matcher.exec(text)
      continue
    }

    if (match.index > cursor) {
      segments.push({ type: 'text', value: text.slice(cursor, match.index) })
    }

    segments.push({ type: 'emoji', emoji })
    cursor = match.index + rawCode.length
    match = matcher.exec(text)
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', value: text.slice(cursor) })
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', value: text })
  }

  return segments
}

export interface ChatEmojiDefinition {
  slug: string
  code: string
  symbol: string
  label: string
}

export const STANDARD_CHAT_EMOJIS: ChatEmojiDefinition[] = [
  { slug: 'smile', code: ':smile:', symbol: '\u{1F600}', label: 'smile' },
  { slug: 'cool', code: ':cool:', symbol: '\u{1F60E}', label: 'cool' },
  { slug: 'laugh', code: ':laugh:', symbol: '\u{1F602}', label: 'laugh' },
  { slug: 'rofl', code: ':rofl:', symbol: '\u{1F923}', label: 'rofl' },
  { slug: 'cry', code: ':cry:', symbol: '\u{1F62D}', label: 'cry' },
  { slug: 'devil', code: ':devil:', symbol: '\u{1F608}', label: 'devil' },
  { slug: 'angry', code: ':angry:', symbol: '\u{1F621}', label: 'angry' },
  { slug: 'heart', code: ':heart:', symbol: '\u2764\uFE0F', label: 'heart' },
  { slug: 'clover', code: ':clover:', symbol: '\u{1F340}', label: 'clover' },
  { slug: 'coffee', code: ':coffee:', symbol: '\u2615', label: 'coffee' },
  { slug: 'beer', code: ':beer:', symbol: '\u{1F37A}', label: 'beer' },
  { slug: 'cocktail', code: ':cocktail:', symbol: '\u{1F378}', label: 'cocktail' },
  { slug: 'champagne', code: ':champagne:', symbol: '\u{1F942}', label: 'champagne' },
  { slug: 'wine', code: ':wine:', symbol: '\u{1F377}', label: 'wine' },
  { slug: 'cash', code: ':cash:', symbol: '\u{1F4B0}', label: 'cash' },
  { slug: 'diamond', code: ':diamond:', symbol: '\u{1F48E}', label: 'diamond' },
  { slug: 'joker', code: ':joker:', symbol: '\u{1F0CF}', label: 'joker' },
  { slug: 'spade', code: ':spade:', symbol: '\u2660\uFE0F', label: 'spade' },
  { slug: 'heart-suit', code: ':heart-suit:', symbol: '\u2665\uFE0F', label: 'heart suit' },
  { slug: 'diamond-suit', code: ':diamond-suit:', symbol: '\u2666\uFE0F', label: 'diamond suit' },
  { slug: 'club', code: ':club:', symbol: '\u2663\uFE0F', label: 'club' },
  { slug: 'fire', code: ':fire:', symbol: '\u{1F525}', label: 'fire' },
  { slug: 'crown', code: ':crown:', symbol: '\u{1F451}', label: 'crown' },
  { slug: 'party', code: ':party:', symbol: '\u{1F389}', label: 'party' },
  { slug: 'shit', code: ':shit:', symbol: '\u{1F4A9}', label: 'shit' },
  { slug: 'wheelchair', code: ':wheelchair:', symbol: '\u267F\uFE0F', label: 'wheelchair' },
]

export const VIP_CHAT_EMOJIS: ChatEmojiDefinition[] = []
export const CHAT_EMOJIS = STANDARD_CHAT_EMOJIS

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

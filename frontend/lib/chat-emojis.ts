export interface ChatEmojiDefinition {
  slug: string
  code: string
  label: string
  symbol?: string
  imageSrc?: string
  kind?: 'standard' | 'vip'
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

const VIP_EMOJI_BASE_PATH = '/vip-emojis'

export const VIP_CHAT_EMOJIS: ChatEmojiDefinition[] = [
  { slug: 'vip-all-in', code: ':vip-all-in:', imageSrc: `${VIP_EMOJI_BASE_PATH}/all-in.png`, label: 'all in', kind: 'vip' },
  { slug: 'vip-angry', code: ':vip-angry:', imageSrc: `${VIP_EMOJI_BASE_PATH}/angry.png`, label: 'angry', kind: 'vip' },
  { slug: 'vip-applause', code: ':vip-applause:', imageSrc: `${VIP_EMOJI_BASE_PATH}/applause.png`, label: 'applause', kind: 'vip' },
  { slug: 'vip-big-pot', code: ':vip-big-pot:', imageSrc: `${VIP_EMOJI_BASE_PATH}/big-pot.png`, label: 'big pot', kind: 'vip' },
  { slug: 'vip-blackjack-21', code: ':vip-blackjack-21:', imageSrc: `${VIP_EMOJI_BASE_PATH}/blackjack-21.png`, label: 'blackjack 21', kind: 'vip' },
  { slug: 'vip-bluff', code: ':vip-bluff:', imageSrc: `${VIP_EMOJI_BASE_PATH}/bluff.png`, label: 'bluff', kind: 'vip' },
  { slug: 'vip-bust', code: ':vip-bust:', imageSrc: `${VIP_EMOJI_BASE_PATH}/bust.png`, label: 'bust', kind: 'vip' },
  { slug: 'vip-cheers', code: ':vip-cheers:', imageSrc: `${VIP_EMOJI_BASE_PATH}/cheers.png`, label: 'cheers', kind: 'vip' },
  { slug: 'vip-crying', code: ':vip-crying:', imageSrc: `${VIP_EMOJI_BASE_PATH}/crying.png`, label: 'crying', kind: 'vip' },
  { slug: 'vip-double-down', code: ':vip-double-down:', imageSrc: `${VIP_EMOJI_BASE_PATH}/double-down.png`, label: 'double down', kind: 'vip' },
  { slug: 'vip-facepalm', code: ':vip-facepalm:', imageSrc: `${VIP_EMOJI_BASE_PATH}/facepalm.png`, label: 'facepalm', kind: 'vip' },
  { slug: 'vip-fold', code: ':vip-fold:', imageSrc: `${VIP_EMOJI_BASE_PATH}/fold.png`, label: 'fold', kind: 'vip' },
  { slug: 'vip-good-game', code: ':vip-good-game:', imageSrc: `${VIP_EMOJI_BASE_PATH}/good-game.png`, label: 'good game', kind: 'vip' },
  { slug: 'vip-hit-me', code: ':vip-hit-me:', imageSrc: `${VIP_EMOJI_BASE_PATH}/hit-me.png`, label: 'hit me', kind: 'vip' },
  { slug: 'vip-hot-streak', code: ':vip-hot-streak:', imageSrc: `${VIP_EMOJI_BASE_PATH}/hot-streak.png`, label: 'hot streak', kind: 'vip' },
  { slug: 'vip-join-me', code: ':vip-join-me:', imageSrc: `${VIP_EMOJI_BASE_PATH}/join-me.png`, label: 'join me', kind: 'vip' },
  { slug: 'vip-laughing', code: ':vip-laughing:', imageSrc: `${VIP_EMOJI_BASE_PATH}/laughing.png`, label: 'laughing', kind: 'vip' },
  { slug: 'vip-love-it', code: ':vip-love-it:', imageSrc: `${VIP_EMOJI_BASE_PATH}/love-it.png`, label: 'love it', kind: 'vip' },
  { slug: 'vip-lucky-ace', code: ':vip-lucky-ace:', imageSrc: `${VIP_EMOJI_BASE_PATH}/lucky-ace.png`, label: 'lucky ace', kind: 'vip' },
  { slug: 'vip-raise', code: ':vip-raise:', imageSrc: `${VIP_EMOJI_BASE_PATH}/raise.png`, label: 'raise', kind: 'vip' },
  { slug: 'vip-respect', code: ':vip-respect:', imageSrc: `${VIP_EMOJI_BASE_PATH}/respect.png`, label: 'respect', kind: 'vip' },
  { slug: 'vip-rolling', code: ':vip-rolling:', imageSrc: `${VIP_EMOJI_BASE_PATH}/rolling.png`, label: 'rolling', kind: 'vip' },
  { slug: 'vip-royal-flush', code: ':vip-royal-flush:', imageSrc: `${VIP_EMOJI_BASE_PATH}/royal-flush.png`, label: 'royal flush', kind: 'vip' },
  { slug: 'vip-shocked', code: ':vip-shocked:', imageSrc: `${VIP_EMOJI_BASE_PATH}/shocked.png`, label: 'shocked', kind: 'vip' },
  { slug: 'vip-stand', code: ':vip-stand:', imageSrc: `${VIP_EMOJI_BASE_PATH}/stand.png`, label: 'stand', kind: 'vip' },
]

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

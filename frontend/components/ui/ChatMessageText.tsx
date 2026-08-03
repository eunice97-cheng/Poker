'use client'

import { getChatMessageSegments } from '@/lib/chat-emojis'

interface ChatMessageTextProps {
  text: string
  size?: 'sm' | 'md'
  className?: string
}

export function ChatMessageText({ text, size = 'md', className }: ChatMessageTextProps) {
  const segments = getChatMessageSegments(text)
  const emojiClassName = size === 'sm' ? 'text-[20px]' : 'text-[24px]'

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={`text-${index}`}>{segment.value}</span>
        }

        return (
          <span
            key={`emoji-${segment.emoji.code}-${index}`}
            className={`mx-0.5 inline-flex leading-none align-[-0.18em] ${emojiClassName}`}
            role="img"
            aria-label={segment.emoji.label}
          >
            {segment.emoji.symbol}
          </span>
        )
      })}
    </span>
  )
}

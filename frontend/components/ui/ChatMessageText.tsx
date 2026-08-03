'use client'

import Image from 'next/image'
import { getChatMessageSegments } from '@/lib/chat-emojis'

interface ChatMessageTextProps {
  text: string
  size?: 'sm' | 'md'
  className?: string
}

export function ChatMessageText({ text, size = 'md', className }: ChatMessageTextProps) {
  const segments = getChatMessageSegments(text)
  const emojiClassName = size === 'sm' ? 'text-[20px]' : 'text-[24px]'
  const vipEmojiClassName = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={`text-${index}`}>{segment.value}</span>
        }

        if (segment.emoji.imageSrc) {
          return (
            <span
              key={`emoji-${segment.emoji.code}-${index}`}
              className={`mx-1 inline-flex shrink-0 align-middle ${vipEmojiClassName}`}
              role="img"
              aria-label={segment.emoji.label}
            >
              <Image
                src={segment.emoji.imageSrc}
                alt=""
                width={96}
                height={96}
                className="h-full w-full object-contain"
                aria-hidden="true"
              />
            </span>
          )
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

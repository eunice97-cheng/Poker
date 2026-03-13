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
  const dimension = size === 'sm' ? 22 : 26
  const imageClassName = size === 'sm' ? 'h-[22px] w-[22px]' : 'h-[26px] w-[26px]'

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={`text-${index}`}>{segment.value}</span>
        }

        return (
          <span key={`emoji-${segment.emoji.code}-${index}`} className="mx-0.5 inline-flex align-[-0.4em]">
            <Image
              src={segment.emoji.src}
              alt={segment.emoji.label}
              width={dimension}
              height={dimension}
              className={imageClassName}
            />
          </span>
        )
      })}
    </span>
  )
}

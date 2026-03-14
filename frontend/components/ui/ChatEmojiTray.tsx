'use client'

import Image from 'next/image'
import { STANDARD_CHAT_EMOJIS, VIP_CHAT_EMOJIS } from '@/lib/chat-emojis'

interface ChatEmojiTrayProps {
  hasVipAccess: boolean
  onSelect: (emojiCode: string) => void
  variant?: 'table' | 'lobby'
}

export function ChatEmojiTray({
  hasVipAccess,
  onSelect,
  variant = 'lobby',
}: ChatEmojiTrayProps) {
  const isTable = variant === 'table'
  const sectionTitleClassName = isTable
    ? 'text-[10px] uppercase tracking-[0.22em] text-white/38'
    : 'text-[10px] uppercase tracking-[0.24em] text-[#f3d2a2]/42'
  const trayClassName = isTable
    ? 'max-h-36 space-y-2.5 overflow-y-auto px-2.5 py-2'
    : 'max-h-60 space-y-2.5 overflow-y-auto rounded-2xl border border-white/8 bg-black/18 px-2.5 py-2.5'
  const gridClassName = isTable ? 'grid grid-cols-5 gap-1.5' : 'grid grid-cols-6 gap-1.5 sm:grid-cols-8'
  const buttonClassName = isTable
    ? 'group flex h-12 w-full items-center justify-center rounded-[1.1rem] border border-white/10 bg-white/5 transition-all hover:border-yellow-400/30 hover:bg-white/10'
    : 'group flex h-12 w-full items-center justify-center rounded-[1.1rem] border border-white/10 bg-black/24 transition-all hover:border-[#f3d2a2]/30 hover:bg-black/40'
  const disabledButtonClassName = isTable
    ? 'flex h-12 w-full items-center justify-center rounded-[1.1rem] border border-white/8 bg-white/[0.03] opacity-35 grayscale'
    : 'flex h-12 w-full items-center justify-center rounded-[1.1rem] border border-white/8 bg-black/14 opacity-35 grayscale'

  return (
    <div className={trayClassName}>
      <section className="space-y-2">
        <div className={sectionTitleClassName}>Emoji</div>
        <div className={gridClassName}>
          {STANDARD_CHAT_EMOJIS.map((emoji) => (
            <button
              key={emoji.code}
              type="button"
              onClick={() => onSelect(emoji.code)}
              className={buttonClassName}
              aria-label={`Insert ${emoji.label}`}
              title={emoji.label}
            >
              <Image src={emoji.src} alt={emoji.label} width={40} height={40} className="h-10 w-10 object-contain" />
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className={sectionTitleClassName}>{hasVipAccess ? 'VIP emoji' : 'VIP emoji locked'}</div>
          {!hasVipAccess && (
            <div className={isTable ? 'text-[9px] uppercase tracking-[0.2em] text-yellow-300/55' : 'text-[9px] uppercase tracking-[0.2em] text-[#f3d2a2]/52'}>
              Unlock after first donation
            </div>
          )}
        </div>
        <div className={gridClassName}>
          {VIP_CHAT_EMOJIS.map((emoji) => (
            <button
              key={emoji.code}
              type="button"
              onClick={() => onSelect(emoji.code)}
              disabled={!hasVipAccess}
              className={hasVipAccess ? buttonClassName : disabledButtonClassName}
              aria-label={hasVipAccess ? `Insert ${emoji.label}` : `${emoji.label} is locked`}
              title={hasVipAccess ? emoji.label : `${emoji.label} unlocks after your first donation`}
            >
              <Image src={emoji.src} alt={emoji.label} width={40} height={40} className="h-10 w-10 object-contain" />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

'use client'

import Image from 'next/image'
import { STANDARD_CHAT_EMOJIS, VIP_CHAT_EMOJIS } from '@/lib/chat-emojis'

interface ChatEmojiTrayProps {
  hasVipAccess?: boolean
  onSelect: (emojiCode: string) => void
  onLockedSelect?: () => void
  variant?: 'table' | 'lobby'
  category?: 'standard' | 'vip'
}

export function ChatEmojiTray({
  hasVipAccess = false,
  onSelect,
  onLockedSelect,
  variant = 'lobby',
  category = 'standard',
}: ChatEmojiTrayProps) {
  const isTable = variant === 'table'
  const isVip = category === 'vip'
  const emojis = isVip ? VIP_CHAT_EMOJIS : STANDARD_CHAT_EMOJIS
  const sectionTitleClassName = isTable
    ? 'text-[10px] uppercase tracking-[0.22em] text-white/38'
    : 'text-[10px] uppercase tracking-[0.24em] text-[#f3d2a2]/42'
  const trayClassName = isTable
    ? 'max-h-36 space-y-2.5 overflow-y-auto px-2.5 py-2'
    : `space-y-2.5 overflow-y-auto rounded-2xl border border-white/8 bg-black/18 ${isVip ? 'max-h-80 px-3 py-3' : 'max-h-60 px-2.5 py-2.5'}`
  const gridGapClassName = isVip ? 'gap-2' : 'gap-1.5'
  const gridClassName = isTable
    ? `casino-chat-emoji-tray__grid grid ${isVip ? 'grid-cols-4' : 'grid-cols-5'} ${gridGapClassName}`
    : `casino-chat-emoji-tray__grid grid ${isVip ? 'grid-cols-4' : 'grid-cols-7'} ${gridGapClassName}`
  const buttonClassName = isVip
    ? `group flex ${isTable ? 'min-h-[4rem]' : 'min-h-[4.8rem]'} w-full flex-col items-center justify-center gap-1 rounded-[1rem] border border-white/10 bg-black/24 px-1.5 py-1.5 transition-all hover:border-[#f3d2a2]/30 hover:bg-black/40`
    : isTable
        ? 'group flex h-12 w-full items-center justify-center rounded-[1.1rem] border border-white/10 bg-white/5 transition-all hover:border-yellow-400/30 hover:bg-white/10'
      : 'group flex h-10 w-full items-center justify-center rounded-[1rem] border border-white/10 bg-black/24 transition-all hover:border-[#f3d2a2]/30 hover:bg-black/40'
  const emojiClassName = isTable ? 'text-[28px] leading-none' : 'text-[24px] leading-none'
  const imageClassName = isTable ? 'h-11 w-11 object-contain' : 'h-14 w-14 object-contain'
  const isVipLocked = isVip && !hasVipAccess

  return (
    <div className={trayClassName}>
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className={sectionTitleClassName}>{isVip ? 'VIP Emoji' : 'Emoji'}</div>
          {isVipLocked && (
            <div className="shrink-0 rounded-full border border-[#f3d2a2]/14 bg-[#f1b45b]/10 px-2 py-1 text-[8px] font-bold uppercase leading-none tracking-[0.12em] text-[#f3d2a2]/70">
              GM / donors only
            </div>
          )}
        </div>
        <div className={gridClassName}>
          {emojis.map((emoji) => (
            <button
              key={emoji.code}
              type="button"
              onClick={() => {
                if (isVipLocked) {
                  onLockedSelect?.()
                  return
                }
                onSelect(emoji.code)
              }}
              className={`${buttonClassName} ${isVipLocked ? 'opacity-85' : ''}`}
              aria-disabled={isVipLocked}
              aria-label={isVipLocked ? `${emoji.label}, VIP emoji for GM or donors` : `Insert ${emoji.label}`}
              title={isVipLocked ? `${emoji.label} - GM or donors only` : emoji.label}
            >
              {emoji.imageSrc ? (
                <>
                  <Image
                    src={emoji.imageSrc}
                    alt=""
                    width={64}
                    height={64}
                    className={imageClassName}
                    aria-hidden="true"
                  />
                  <small className="max-w-full truncate text-[9px] font-semibold uppercase leading-none tracking-[0.08em] text-[#f3d2a2]/68">
                    {emoji.label}
                  </small>
                </>
              ) : (
                <span className={emojiClassName} aria-hidden="true">{emoji.symbol}</span>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

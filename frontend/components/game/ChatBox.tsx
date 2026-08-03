'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '@/types/poker'
import { appendChatEmojiCode, hasVipChatEmojiCode, isVipChatEmojiCode } from '@/lib/chat-emojis'
import { ChatEmojiTray } from '@/components/ui/ChatEmojiTray'
import { ChatMessageText } from '@/components/ui/ChatMessageText'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'

interface ChatBoxProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  myPlayerId: string
  hasVipEmojis: boolean
  initialCollapsed?: boolean
}

const MAX_CHAT_LENGTH = 200

function formatTableChatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function FallbackAvatar({ username }: { username: string }) {
  const letter = username.trim().charAt(0).toUpperCase() || '?'
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-bold text-white/70">
      {letter}
    </div>
  )
}

function TableChatIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.25 6.75C5.25 5.78 6.03 5 7 5h10c.97 0 1.75.78 1.75 1.75v7.5c0 .97-.78 1.75-1.75 1.75h-5.24l-4.2 3.05A.82.82 0 0 1 6.25 18.4V16H7a1.75 1.75 0 0 1-1.75-1.75v-7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8.7 9.25h6.6M8.7 12.15h4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function EmojiIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.8 10h.01M15.2 10h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8.8 14.2c1.65 1.75 4.75 1.75 6.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function VipEmojiIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.2 18.6h13.6M6.1 16.2l-1-8.1 4.7 3.2L12 5.4l2.2 5.9 4.7-3.2-1 8.1H6.1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.2 14.1h5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function ChatBox({ messages, onSend, myPlayerId, hasVipEmojis, initialCollapsed = false }: ChatBoxProps) {
  const [input, setInput] = useState('')
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [activeEmojiTray, setActiveEmojiTray] = useState<'standard' | 'vip' | null>(null)
  const [error, setError] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const previousMessageCountRef = useRef(messages.length)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (collapsed) {
      setActiveEmojiTray(null)
      return
    }
    setUnreadCount(0)
  }, [collapsed])

  useEffect(() => {
    if (messages.length < previousMessageCountRef.current) {
      previousMessageCountRef.current = messages.length
      return
    }

    const nextMessages = messages.slice(previousMessageCountRef.current)
    previousMessageCountRef.current = messages.length
    if (!collapsed || nextMessages.length === 0) return

    const unreadMessages = nextMessages.filter((message) => !message.isSystem && message.playerId !== myPlayerId)
    if (unreadMessages.length > 0) {
      setUnreadCount((count) => Math.min(count + unreadMessages.length, 99))
    }
  }, [collapsed, messages, myPlayerId])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    if (!hasVipEmojis && hasVipChatEmojiCode(text)) {
      setError('VIP emoji are for GM or donors')
      return
    }
    onSend(text)
    setInput('')
    setError('')
    setActiveEmojiTray(null)
  }

  const appendEmoji = (emojiCode: string) => {
    if (!hasVipEmojis && isVipChatEmojiCode(emojiCode)) {
      setError('VIP emoji are for GM or donors')
      return
    }
    setError('')
    setInput((prev) => appendChatEmojiCode(prev, emojiCode, MAX_CHAT_LENGTH))
  }

  const showEmojiTray = activeEmojiTray === 'standard'
  const showVipEmojiTray = activeEmojiTray === 'vip'
  const messageCountLabel = messages.length === 1 ? '1 msg' : `${messages.length} msgs`
  const unreadLabel = unreadCount > 99 ? '99+' : unreadCount.toString()

  return (
    <div
      data-open={collapsed ? 'false' : 'true'}
      data-unread={unreadCount > 0 ? 'true' : 'false'}
      className={`casino-table-chat flex flex-col overflow-hidden border border-[#f3d2a2]/12 bg-[linear-gradient(180deg,rgba(16,8,7,0.88),rgba(16,8,7,0.62))] shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all ${collapsed ? 'h-12 w-12 self-end rounded-full' : 'h-72 rounded-[30px] sm:h-80'}`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className={`casino-table-chat__toggle flex items-center justify-between gap-3 text-left ${collapsed ? 'h-12 rounded-full px-3' : 'border-b border-white/8 px-4 py-3'}`}
        aria-label={collapsed ? 'Show table chat' : 'Hide table chat'}
      >
        {collapsed ? (
          <span className="casino-table-chat__icon-box relative flex h-full w-full items-center justify-center rounded-full" aria-hidden="true">
            <TableChatIcon />
            {unreadCount > 0 && (
              <span className="casino-table-chat__unread-badge absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#2b120a] bg-[#f1b45b] px-1 text-[10px] font-bold text-[#1b0d06]">
                {unreadLabel}
              </span>
            )}
          </span>
        ) : (
          <>
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-[0.28em] text-[#f3d2a2]/42">Table chat</span>
              <span className="casino-table-chat__title mt-1 block font-serif text-xl text-[#fff3e2]">Hear the table</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/52">
                {messageCountLabel}
              </span>
              <span className="casino-table-chat__icon-box flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[#fff3e2]/72">
                <TableChatIcon />
              </span>
            </span>
          </>
        )}
      </button>

      {!collapsed && (
        <>
          <div className="casino-table-chat__messages min-h-[5rem] flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm leading-5">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-black/18 px-4 py-5 text-sm text-white/55">
                No table messages yet.
              </div>
            ) : (
              messages.map((msg, i) => (
                msg.isSystem ? (
                  <div key={`${msg.timestamp}-${i}`} className="rounded-2xl border border-[#f3d2a2]/10 bg-[#f1b45b]/7 px-3 py-2 text-xs italic leading-5 text-[#f7dfba]/76">
                    <ChatMessageText text={msg.text} size="sm" />
                  </div>
                ) : (
                  <div key={`${msg.playerId}-${msg.timestamp}-${i}`} className="flex gap-3 rounded-2xl border border-white/8 bg-black/14 px-3 py-3">
                    {msg.avatar ? <AvatarDisplay avatarId={msg.avatar} size="sm" className="rounded-full border-white/10" /> : <FallbackAvatar username={msg.username} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`truncate text-sm font-semibold ${msg.playerId === myPlayerId ? 'text-amber-200' : 'text-white'}`}>{msg.username}</span>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">{formatTableChatTime(msg.timestamp)}</span>
                      </div>
                      <p className="mt-1 break-words whitespace-pre-wrap text-sm leading-6 text-white/72">
                        <ChatMessageText text={msg.text} size="sm" />
                      </p>
                    </div>
                  </div>
                )
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="casino-table-chat__form shrink-0 border-t border-white/8 px-3 py-3">
            {activeEmojiTray && (
              <div className="casino-table-chat__emoji-tray mb-2 rounded-2xl border border-white/8 bg-black/18">
                <ChatEmojiTray
                  hasVipAccess={hasVipEmojis}
                  onSelect={appendEmoji}
                  onLockedSelect={() => setError('VIP emoji are for GM or donors')}
                  variant="table"
                  category={activeEmojiTray}
                />
              </div>
            )}

            <div className="casino-table-chat__compose flex items-center gap-2 px-2 py-2">
              <button
                type="button"
                onClick={() => setActiveEmojiTray((current) => (current === 'standard' ? null : 'standard'))}
                className={`casino-table-chat__emoji-button flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-[#fff3e2]/72 transition-colors ${
                  showEmojiTray
                    ? 'border-[#f3d2a2]/38 bg-[#f1b45b]/14 text-[#fff3e2]'
                    : 'border-[#f3d2a2]/16 bg-[rgba(12,7,7,0.72)] hover:border-[#f3d2a2]/32 hover:text-[#fff3e2]'
                }`}
                aria-pressed={showEmojiTray}
                aria-label={showEmojiTray ? 'Hide emoji picker' : 'Show emoji picker'}
                title={showEmojiTray ? 'Hide emoji picker' : 'Show emoji picker'}
              >
                <EmojiIcon />
              </button>
              <button
                type="button"
                onClick={() => setActiveEmojiTray((current) => (current === 'vip' ? null : 'vip'))}
                className={`casino-table-chat__emoji-button flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors ${
                  showVipEmojiTray
                    ? 'border-[#f3d2a2]/48 bg-[#f1b45b]/18 text-[#ffe5a4]'
                    : 'border-[#f3d2a2]/16 bg-[rgba(12,7,7,0.72)] text-[#f3d2a2]/72 hover:border-[#f3d2a2]/36 hover:text-[#ffe5a4]'
                }`}
                aria-pressed={showVipEmojiTray}
                aria-label={showVipEmojiTray ? 'Hide VIP emoji picker' : 'Show VIP emoji picker'}
                title={showVipEmojiTray ? 'Hide VIP emoji picker' : 'Show VIP emoji picker'}
              >
                <VipEmojiIcon />
              </button>
              <textarea
                className="casino-table-chat__input min-w-0 flex-1 resize-none appearance-none rounded-2xl border border-[#f3d2a2]/16 bg-[rgba(12,7,7,0.82)] px-3 py-2 text-sm text-[#fff3e2] caret-[#f3d2a2] outline-none transition-colors placeholder:text-[#d4b89b]/55 focus:border-[#f3d2a2]/42 focus:bg-[rgba(12,7,7,0.92)]"
                placeholder="Say something at the table..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                maxLength={MAX_CHAT_LENGTH}
                rows={1}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim()}
                className="rounded-full border border-[#f3d2a2]/16 bg-[#f1b45b] px-4 py-2 text-sm font-semibold text-[#20110a] transition-colors hover:bg-[#f4c272] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <div className="mt-1 flex min-h-4 items-center justify-between gap-3 px-1">
              <div className="text-xs text-red-300/90">{error}</div>
              <div className="text-xs text-[#d4b89b]/55">{input.trim().length}/{MAX_CHAT_LENGTH}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { ChatEmojiTray } from '@/components/ui/ChatEmojiTray'
import { ChatMessageText } from '@/components/ui/ChatMessageText'
import { appendChatEmojiCode } from '@/lib/chat-emojis'
import { ChatMessage, Profile } from '@/types/poker'

interface LobbyChatProps {
  socket: Socket | null
  profile: Profile | null
  hasVipEmojis: boolean
  compactLandscape?: boolean
}

const MAX_LOBBY_CHAT_LENGTH = 240

function formatTime(timestamp: string) {
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

function ChatToggleIcon({ className = 'h-5 w-5' }: { className?: string }) {
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

export function LobbyChat({ socket, profile, hasVipEmojis, compactLandscape = false }: LobbyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(!compactLandscape)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showEmojiTray, setShowEmojiTray] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const openRef = useRef(open)
  const profileIdRef = useRef(profile?.id)

  useEffect(() => {
    profileIdRef.current = profile?.id
  }, [profile?.id])

  useEffect(() => {
    openRef.current = open
    if (open) setUnreadCount(0)
    if (!open) setShowEmojiTray(false)
  }, [open])

  useEffect(() => {
    if (compactLandscape) {
      setOpen(false)
      return
    }

    const shouldCollapseOnPhone = window.matchMedia('(max-width: 940px), (max-height: 560px), (max-width: 900px) and (max-height: 430px) and (orientation: landscape)').matches
    if (shouldCollapseOnPhone) setOpen(false)
  }, [compactLandscape])

  useEffect(() => {
    document.body.classList.toggle('casino-lobby-chat-open', open)
    return () => document.body.classList.remove('casino-lobby-chat-open')
  }, [open])

  useEffect(() => {
    if (!socket) return

    const onHistory = (history: ChatMessage[]) => {
      setMessages(history)
      if (!openRef.current) setUnreadCount(Math.min(history.length, 99))
    }
    const onMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-59), message])
      if (!openRef.current && message.playerId !== profileIdRef.current) {
        setUnreadCount((count) => Math.min(count + 1, 99))
      }
    }

    socket.on('lobby_chat_history', onHistory)
    socket.on('lobby_chat_message', onMessage)
    socket.emit('request_lobby_chat_history')

    return () => {
      socket.off('lobby_chat_history', onHistory)
      socket.off('lobby_chat_message', onMessage)
    }
  }, [socket])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const placeholder = useMemo(() => {
    if (!profile) return 'Say something to the room'
    return `Say something, ${profile.username}`
  }, [profile])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!socket) {
      setError('Chat is still connecting')
      return
    }
    const text = draft.trim()
    if (!text) return

    setSending(true)
    setError('')
    socket.emit('lobby_chat_message', { text }, (res?: { ok?: boolean; error?: string }) => {
      setSending(false)
      if (res?.error) {
        setError(res.error)
        return
      }
      setDraft('')
      setShowEmojiTray(false)
    })
  }

  const appendEmoji = (emojiCode: string) => {
    setDraft((prev) => appendChatEmojiCode(prev, emojiCode, MAX_LOBBY_CHAT_LENGTH))
  }

  const unreadLabel = unreadCount > 99 ? '99+' : unreadCount.toString()

  return (
    <div
      data-open={open ? 'true' : 'false'}
      data-unread={unreadCount > 0 ? 'true' : 'false'}
      className={`casino-lobby-chat fixed bottom-3 right-1 z-[10000] max-w-[calc(100vw-0.5rem)] transition-all md:bottom-6 md:right-3 ${
        open ? 'w-[336px]' : 'left-auto w-auto'
      }`}
    >
      <div
        className={`casino-lobby-chat__panel overflow-hidden border border-[#f3d2a2]/12 bg-[linear-gradient(180deg,rgba(16,8,7,0.88),rgba(16,8,7,0.62))] shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-200 ${
          open ? 'rounded-[30px]' : 'rounded-full'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`casino-lobby-chat__toggle flex items-center justify-between gap-3 text-left ${open ? 'w-full px-3 py-3 md:px-4' : 'h-12 w-12 justify-center rounded-full p-0'}`}
          aria-label={open ? 'Hide lounge chat' : 'Show lounge chat'}
        >
          {open ? (
            <>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.28em] text-[#f3d2a2]/42">Lounge chat</div>
                <div className="casino-lobby-chat__title mt-1 font-serif text-lg text-[#fff3e2] md:text-xl">
                  Hear the room
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/52 md:px-3 md:tracking-[0.22em]">
                  {messages.length} msgs
                </div>
                <div className="casino-lobby-chat__icon-box flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[#fff3e2]/72">
                  <ChatToggleIcon className="h-4 w-4" />
                </div>
              </div>
            </>
          ) : (
            <div className="casino-lobby-chat__icon-box relative flex h-full w-full items-center justify-center rounded-full" aria-hidden="true">
              <ChatToggleIcon />
              {unreadCount > 0 && (
                <span className="casino-lobby-chat__unread-badge absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#2b120a] bg-[#f1b45b] px-1 text-[10px] font-bold text-[#1b0d06]">
                  {unreadLabel}
                </span>
              )}
            </div>
          )}
        </button>

        {open && (
          <div className="casino-lobby-chat__body border-t border-white/8 px-3 pb-3 pt-3 md:px-4 md:pb-4">
            <div ref={scrollRef} className="casino-lobby-chat__messages h-[48vh] max-h-72 space-y-3 overflow-y-auto pr-1 md:h-72">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-black/18 px-4 py-5 text-sm text-white/55">
                  No one has said anything yet. Start the first table or break the silence.
                </div>
              ) : (
                messages.map((message, index) => {
                  const isSelf = profile?.id === message.playerId
                  return (
                    <div key={`${message.playerId}-${message.timestamp}-${index}`} className="flex gap-3 rounded-2xl border border-white/8 bg-black/14 px-3 py-3">
                      {message.avatar ? <AvatarDisplay avatarId={message.avatar} size="sm" className="rounded-full border-white/10" /> : <FallbackAvatar username={message.username} />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`truncate text-sm font-semibold ${isSelf ? 'text-amber-200' : 'text-white'}`}>{message.username}</span>
                          <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">{formatTime(message.timestamp)}</span>
                        </div>
                        <p className="mt-1 break-words whitespace-pre-wrap text-sm leading-6 text-white/72">
                          <ChatMessageText text={message.text} />
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <form onSubmit={submit} className="casino-lobby-chat__form mt-3 space-y-2">
              {showEmojiTray && (
                <div className="casino-lobby-chat__emoji-tray">
                  <ChatEmojiTray hasVipAccess={hasVipEmojis} onSelect={appendEmoji} />
                </div>
              )}
              <div className="casino-lobby-chat__compose flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmojiTray((value) => !value)}
                  className={`casino-lobby-chat__emoji-button flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border text-[#fff3e2]/72 transition-colors ${
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
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, MAX_LOBBY_CHAT_LENGTH))}
                  rows={2}
                  placeholder={placeholder}
                  className="casino-lobby-chat__input min-w-0 flex-1 resize-none appearance-none rounded-2xl border border-[#f3d2a2]/16 bg-[rgba(12,7,7,0.82)] px-4 py-3 text-sm text-[#fff3e2] caret-[#f3d2a2] outline-none transition-colors placeholder:text-[#d4b89b]/55 focus:border-[#f3d2a2]/42 focus:bg-[rgba(12,7,7,0.92)]"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-red-300/90">{error || `${draft.trim().length}/${MAX_LOBBY_CHAT_LENGTH}`}</div>
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="rounded-full border border-[#f3d2a2]/16 bg-[#f1b45b] px-4 py-2 text-sm font-semibold text-[#20110a] transition-colors hover:bg-[#f4c272] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

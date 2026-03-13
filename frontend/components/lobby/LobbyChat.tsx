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

export function LobbyChat({ socket, profile, hasVipEmojis }: LobbyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!socket) return

    const onHistory = (history: ChatMessage[]) => setMessages(history)
    const onMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-59), message])
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
    })
  }

  const appendEmoji = (emojiCode: string) => {
    setDraft((prev) => appendChatEmojiCode(prev, emojiCode, MAX_LOBBY_CHAT_LENGTH))
  }

  return (
    <div
      className={`fixed bottom-3 z-30 transition-all md:bottom-6 md:right-6 ${
        open ? 'left-3 right-3 md:left-auto md:w-[360px] xl:w-[390px]' : 'right-3 left-auto md:w-auto'
      }`}
    >
      <div
        className={`overflow-hidden border border-[#f3d2a2]/12 bg-[linear-gradient(180deg,rgba(16,8,7,0.88),rgba(16,8,7,0.62))] shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-200 ${
          open ? 'rounded-[30px]' : 'rounded-full'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`flex items-center justify-between gap-3 text-left ${open ? 'w-full px-3 py-3 md:px-4' : 'w-full px-3 py-2.5 md:px-4'}`}
        >
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.28em] text-[#f3d2a2]/42">Lounge chat</div>
            <div className={open ? 'mt-1 font-serif text-lg text-[#fff3e2] md:text-xl' : 'text-sm font-semibold text-[#fff3e2]'}>
              Hear the room
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/52 md:px-3 md:tracking-[0.22em]">
              {messages.length} msgs
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60 md:tracking-[0.22em]">
              {open ? 'Hide' : 'Show'}
            </div>
          </div>
        </button>

        {open && (
          <div className="border-t border-white/8 px-3 pb-3 pt-3 md:px-4 md:pb-4">
            <div ref={scrollRef} className="h-[48vh] max-h-72 space-y-3 overflow-y-auto pr-1 md:h-72">
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

            <form onSubmit={submit} className="mt-3 space-y-2">
              <ChatEmojiTray hasVipAccess={hasVipEmojis} onSelect={appendEmoji} />
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_LOBBY_CHAT_LENGTH))}
                rows={2}
                placeholder={placeholder}
                className="w-full resize-none appearance-none rounded-2xl border border-[#f3d2a2]/16 bg-[rgba(12,7,7,0.82)] px-4 py-3 text-sm text-[#fff3e2] caret-[#f3d2a2] outline-none transition-colors placeholder:text-[#d4b89b]/55 focus:border-[#f3d2a2]/42 focus:bg-[rgba(12,7,7,0.92)]"
              />
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

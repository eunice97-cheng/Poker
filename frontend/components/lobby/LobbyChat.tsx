'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { ChatMessage, Profile } from '@/types/poker'

interface LobbyChatProps {
  socket: Socket
  profile: Profile | null
}

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

export function LobbyChat({ socket, profile }: LobbyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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

  return (
    <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-[#f3d2a2]/42">Lounge chat</div>
          <div className="mt-2 font-serif text-2xl text-[#fff3e2]">Hear the room before you join it</div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/52">
          Live
        </div>
      </div>

      <div ref={scrollRef} className="mt-4 h-72 space-y-3 overflow-y-auto pr-1">
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
                  <p className="mt-1 break-words text-sm leading-6 text-white/72">{message.text}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 240))}
          rows={3}
          placeholder={placeholder}
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/18 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#f3d2a2]/26"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-red-300/90">{error || `${draft.trim().length}/240`}</div>
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
  )
}


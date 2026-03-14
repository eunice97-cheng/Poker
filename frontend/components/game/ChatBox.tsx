'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '@/types/poker'
import { appendChatEmojiCode } from '@/lib/chat-emojis'
import { ChatEmojiTray } from '@/components/ui/ChatEmojiTray'
import { ChatMessageText } from '@/components/ui/ChatMessageText'

interface ChatBoxProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  myPlayerId: string
  hasVipEmojis: boolean
}

const MAX_CHAT_LENGTH = 200

export function ChatBox({ messages, onSend, myPlayerId, hasVipEmojis }: ChatBoxProps) {
  const [input, setInput] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [showEmojiTray, setShowEmojiTray] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (collapsed) {
      setShowEmojiTray(false)
    }
  }, [collapsed])

  const handleSend = () => {
    if (!input.trim()) return
    onSend(input.trim())
    setInput('')
  }

  const appendEmoji = (emojiCode: string) => {
    setInput((prev) => appendChatEmojiCode(prev, emojiCode, MAX_CHAT_LENGTH))
    setShowEmojiTray(false)
  }

  return (
    <div className={`flex flex-col rounded-xl border border-gray-700 bg-black/70 shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition-all ${collapsed ? 'h-10' : 'h-72 sm:h-80'}`}>
      <button
        onClick={() => setCollapsed((current) => !current)}
        className="flex items-center justify-between border-b border-gray-700/50 px-3 py-2 text-sm text-gray-400 hover:text-white"
      >
        <span>Chat</span>
        <span>{collapsed ? 'Show' : 'Hide'}</span>
      </button>

      {!collapsed && (
        <>
          <div className="min-h-[5rem] flex-1 space-y-1.5 overflow-y-auto px-3 py-2 text-sm leading-5">
            {messages.map((msg, i) => (
              msg.isSystem ? (
                <div key={i} className="py-0.5 text-xs italic leading-5 text-gray-500">
                  <ChatMessageText text={msg.text} size="sm" />
                </div>
              ) : (
                <div key={i} className={msg.playerId === myPlayerId ? 'text-yellow-300' : 'text-gray-300'}>
                  <span className="font-semibold">{msg.username}: </span>
                  <ChatMessageText text={msg.text} size="sm" />
                </div>
              )
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 border-t border-gray-700/50">
            {showEmojiTray && (
              <div className="border-b border-gray-700/50">
                <ChatEmojiTray hasVipAccess={hasVipEmojis} onSelect={appendEmoji} variant="table" />
              </div>
            )}

            <div className="flex items-center gap-2 px-2 py-2">
              <button
                type="button"
                onClick={() => setShowEmojiTray((current) => !current)}
                className="rounded-lg border border-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-yellow-500/40 hover:text-yellow-300"
              >
                {showEmojiTray ? 'Hide' : 'Emoji'}
              </button>
              <input
                className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm text-white outline-none placeholder-gray-600"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                maxLength={MAX_CHAT_LENGTH}
              />
              <button
                type="button"
                onClick={handleSend}
                className="px-2 text-sm font-bold text-yellow-400 hover:text-yellow-300"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

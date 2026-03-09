'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '@/types/poker'

interface ChatBoxProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  myPlayerId: string
}

export function ChatBox({ messages, onSend, myPlayerId }: ChatBoxProps) {
  const [input, setInput] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className={`bg-black/60 border border-gray-700 rounded-xl flex flex-col transition-all ${collapsed ? 'h-10' : 'h-64'}`}>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between px-3 py-2 text-gray-400 hover:text-white text-sm border-b border-gray-700/50"
      >
        <span>Chat</span>
        <span>{collapsed ? '▲' : '▼'}</span>
      </button>

      {!collapsed && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-sm">
            {messages.map((msg, i) => (
              <div key={i} className={msg.playerId === myPlayerId ? 'text-yellow-300' : 'text-gray-300'}>
                <span className="font-semibold">{msg.username}: </span>
                <span>{msg.text}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="flex border-t border-gray-700/50">
            <input
              className="flex-1 bg-transparent text-white text-sm px-3 py-2 outline-none placeholder-gray-600"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
              maxLength={200}
            />
            <button
              onClick={handleSend}
              className="px-3 text-yellow-400 hover:text-yellow-300 text-sm font-bold"
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  )
}

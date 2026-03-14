'use client'

import { useEffect, useRef, useState } from 'react'

interface ActionLogProps {
  logs: string[]
}

export function ActionLog({ logs }: ActionLogProps) {
  const [collapsed, setCollapsed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div
      className={`flex flex-col rounded-xl border border-gray-700 bg-black/70 shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition-all ${
        collapsed ? 'h-10' : 'h-48'
      }`}
    >
      <button
        onClick={() => setCollapsed((current) => !current)}
        className="flex items-center justify-between border-b border-gray-700/50 px-3 py-2 text-sm text-gray-400 hover:text-white"
      >
        <span>Action Log</span>
        <span>{collapsed ? 'Show' : 'Hide'}</span>
      </button>

      {!collapsed && (
        <div className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {logs.map((msg, i) => (
            <div key={i} className="py-0.5 text-[13px] italic leading-5 text-gray-300">
              {msg}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}

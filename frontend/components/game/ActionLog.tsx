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
    <div className={`bg-black/60 border border-gray-700 rounded-xl flex flex-col transition-all ${collapsed ? 'h-10' : 'h-48'}`}>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between px-3 py-2 text-gray-400 hover:text-white text-sm border-b border-gray-700/50"
      >
        <span>Action Log</span>
        <span>{collapsed ? '▲' : '▼'}</span>
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {logs.map((msg, i) => (
            <div key={i} className="text-gray-400 text-xs italic py-0.5">
              {msg}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}

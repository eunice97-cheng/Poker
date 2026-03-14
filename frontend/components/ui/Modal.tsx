'use client'

import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={`mx-auto flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl ${maxWidth}`}>
          <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="text-sm font-semibold text-gray-400 transition-colors hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
        </div>
      </div>
    </div>
  )
}

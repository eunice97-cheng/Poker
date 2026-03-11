'use client'

import { useState } from 'react'

const discordClasses =
  'group flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:bg-indigo-500 hover:shadow-indigo-500/50 active:scale-95'

const kofiClasses =
  'group flex items-center gap-2 rounded-full bg-[#FF5E5B] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:bg-[#ff4340] hover:shadow-red-500/50 active:scale-95'

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" className="flex-shrink-0">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  )
}

function KofiIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" className="flex-shrink-0">
      <path d="M18.5 3H6c-1.1 0-2 .9-2 2v5.71c0 3.83 2.95 7.18 6.78 7.29 3.96.12 7.22-3.06 7.22-7V5c0-.55-.45-1-1-1zm-4 8.5h-3V15h-2v-3.5H6.5V9.5H9.5V7h2v2.5h3v2zm4.5-3H17V5h2v1.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zM4 19h16v2H4z" />
    </svg>
  )
}

export function FloatingButtons() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed right-4 top-20 z-[9999] flex select-none flex-col items-end gap-2 md:right-5 md:top-24">
      <div
        className={`flex flex-col items-end gap-2 transition-all duration-200 ${
          open ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
      >
        {open && (
          <>
            <a
              href="https://discord.com/users/909063517280296961"
              target="_blank"
              rel="noopener noreferrer"
              className={discordClasses}
            >
              <DiscordIcon />
              <span>Message Eunice</span>
            </a>

            <a
              href="https://ko-fi.com/eunicecheng"
              target="_blank"
              rel="noopener noreferrer"
              className={kofiClasses}
            >
              <KofiIcon />
              <span>Tip Eunice</span>
            </a>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Close support menu' : 'Open support menu'}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-900/95 text-white shadow-lg ring-1 ring-white/10 transition-colors hover:bg-gray-800"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
      </button>
    </div>
  )
}

'use client'

const baseButtonClasses =
  'group relative flex items-center overflow-hidden rounded-full text-sm font-semibold text-white transition-all duration-300 hover:scale-105 active:scale-95'

const compactButtonClasses =
  'h-10 w-10 justify-center px-0 sm:h-11 sm:w-11 md:w-11 md:hover:w-[178px] md:justify-start md:px-3'

const discordClasses =
  `${baseButtonClasses} ${compactButtonClasses} bg-[linear-gradient(135deg,#7b2ff7,#f107a3)] shadow-lg shadow-[#b5179e]/30 hover:shadow-[#f72585]/45`

const kofiClasses =
  `${baseButtonClasses} ${compactButtonClasses} bg-[linear-gradient(135deg,#6d28d9,#0f766e)] shadow-lg shadow-[#0f766e]/30 hover:shadow-[#14b8a6]/40`

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="relative z-10 h-[18px] w-[18px] flex-shrink-0">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M10 17a2 2 0 0 0 4 0" />
    </svg>
  )
}

function ChampagneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="relative z-10 h-[18px] w-[18px] flex-shrink-0">
      <path d="M8 3h8v2a4 4 0 0 1-8 0V3Z" />
      <path d="M12 9v7" />
      <path d="M9 21h6" />
      <path d="M10 16h4" />
    </svg>
  )
}

function GoldRim() {
  return (
    <>
      <span className="pointer-events-none absolute inset-0 rounded-full border border-[#f7d57a]/70" />
      <span className="pointer-events-none absolute inset-[1px] rounded-full border border-[#fff2bf]/28" />
      <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#fff1b3] to-transparent opacity-80" />
      <span className="pointer-events-none absolute -inset-px rounded-full shadow-[0_0_18px_rgba(247,213,122,0.22)]" />
    </>
  )
}

export function FloatingButtons() {
  return (
    <div className="fixed right-3 top-16 z-[9999] flex select-none flex-col items-end gap-2 md:right-5 md:top-24">
      <a
        href="https://discord.com/users/909063517280296961"
        target="_blank"
        rel="noopener noreferrer"
        className={discordClasses}
        title="Open Discord and ping the host"
      >
        <GoldRim />
        <BellIcon />
        <span className="relative z-10 hidden whitespace-nowrap pl-2 opacity-0 transition-all duration-300 md:inline md:max-w-0 md:translate-x-1 md:overflow-hidden md:group-hover:max-w-[120px] md:group-hover:translate-x-0 md:group-hover:opacity-100">
          Ping the Host
        </span>
      </a>

      <a
        href="https://ko-fi.com/eunicecheng"
        target="_blank"
        rel="noopener noreferrer"
        className={kofiClasses}
        title="Support the host on Ko-fi"
      >
        <GoldRim />
        <ChampagneIcon />
        <span className="relative z-10 hidden whitespace-nowrap pl-2 opacity-0 transition-all duration-300 md:inline md:max-w-0 md:translate-x-1 md:overflow-hidden md:group-hover:max-w-[120px] md:group-hover:translate-x-0 md:group-hover:opacity-100">
          Tip the Host
        </span>
      </a>
    </div>
  )
}

'use client'

import { usePathname } from 'next/navigation'

const DEFAULT_MAIN_SITE_URL = 'https://arcanastudiolabs.com'

function normalizeUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, '') ?? ''
}

function FlameIcon() {
  return (
    <span className="main-site-flame" aria-hidden="true">
      <svg viewBox="0 0 64 64" className="main-site-flame__svg">
        <defs>
          <radialGradient id="main-site-flame-glow" cx="50%" cy="72%" r="58%">
            <stop offset="0%" stopColor="#fff0a8" stopOpacity="0.95" />
            <stop offset="38%" stopColor="#ff8d5c" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#6c1eff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="main-site-flame-outer" x1="18%" y1="100%" x2="82%" y2="4%">
            <stop offset="0%" stopColor="#ff7a18" />
            <stop offset="34%" stopColor="#ff3d81" />
            <stop offset="68%" stopColor="#9f4bff" />
            <stop offset="100%" stopColor="#4de2ff" />
          </linearGradient>
          <linearGradient id="main-site-flame-middle" x1="26%" y1="100%" x2="74%" y2="10%">
            <stop offset="0%" stopColor="#ffd36f" />
            <stop offset="45%" stopColor="#ff7b63" />
            <stop offset="100%" stopColor="#ff4fd8" />
          </linearGradient>
          <linearGradient id="main-site-flame-core" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#fff7c7" />
            <stop offset="45%" stopColor="#ffe45c" />
            <stop offset="100%" stopColor="#6ff6ff" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="44" rx="21" ry="15" fill="url(#main-site-flame-glow)" className="main-site-flame__glow" />
        <path
          className="main-site-flame__outer"
          fill="url(#main-site-flame-outer)"
          d="M32 6c3 8 13 13 13 25 0 10-6.4 17-13 21-6.7-4-13-11-13-21 0-6.4 2.7-11.3 6.6-15.7 1.6-1.8 3.9-4.1 6.4-9.3Z"
        />
        <path
          className="main-site-flame__middle"
          fill="url(#main-site-flame-middle)"
          d="M31.7 15c2.3 5.7 8.4 9.5 8.4 17.2 0 6.9-4.4 12.2-8.1 15.1-4.6-3.1-8.6-8.2-8.6-15 0-4.2 1.6-7.8 4.2-10.8 1-1.1 2.5-2.8 4.1-6.5Z"
        />
        <path
          className="main-site-flame__core"
          fill="url(#main-site-flame-core)"
          d="M31.8 24c1.6 3.6 5.2 5.6 5.2 10.4 0 4.3-2.5 7.5-5 9.6-3-2-5.2-5-5.2-9.2 0-2.6 1-4.6 2.3-6.2 1-1.2 1.8-2.2 2.7-4.6Z"
        />
      </svg>
    </span>
  )
}

export function MainSiteLink() {
  const pathname = usePathname()
  const href = normalizeUrl(process.env.NEXT_PUBLIC_MAIN_SITE_URL) || DEFAULT_MAIN_SITE_URL

  if (pathname?.startsWith('/table/')) {
    return null
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed left-3 top-3 z-[9998] inline-flex items-center gap-2 rounded-full border border-[#f7d57a]/30 bg-[linear-gradient(135deg,rgba(25,16,10,0.92),rgba(42,24,12,0.86))] px-3 py-2 text-left shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-[#f7d57a]/55 hover:shadow-[0_22px_55px_rgba(0,0,0,0.42)] sm:left-5 sm:top-5"
      aria-label="Open the main Arcana Studio Labs site in a new tab"
    >
      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#f7d57a]/35 bg-[radial-gradient(circle_at_top,rgba(246,217,138,0.16),rgba(158,101,26,0.08))] shadow-[inset_0_1px_0_rgba(255,245,201,0.28)]">
        <FlameIcon />
      </span>
      <span className="hidden min-w-0 sm:block">
        <span className="block text-[10px] uppercase tracking-[0.24em] text-[#f3d2a2]/72">Main site</span>
        <span className="block whitespace-nowrap text-sm font-semibold text-[#fff3e2]">Arcana Studio Labs</span>
      </span>
    </a>
  )
}

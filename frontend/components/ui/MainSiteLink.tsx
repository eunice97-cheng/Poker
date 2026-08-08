'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const DEFAULT_MAIN_SITE_URL = 'https://arcanastudiolabs.com'

function normalizeUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, '') ?? ''
}

function isMobileViewport() {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= 940 || (window.innerWidth <= 1024 && window.innerHeight <= 560)
}

function FlameIcon() {
  return (
    <span className="main-site-flame" aria-hidden="true">
      <svg viewBox="0 0 64 64" className="main-site-flame__svg">
        <defs>
          <radialGradient id="main-site-flame-glow" cx="50%" cy="66%" r="60%">
            <stop offset="0%" stopColor="#fff3b8" stopOpacity="0.92" />
            <stop offset="34%" stopColor="#d99b38" stopOpacity="0.5" />
            <stop offset="72%" stopColor="#7a1f35" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#120707" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="main-site-flame-outer" x1="24%" y1="98%" x2="78%" y2="6%">
            <stop offset="0%" stopColor="#5f1023" />
            <stop offset="32%" stopColor="#b83232" />
            <stop offset="66%" stopColor="#ed9f35" />
            <stop offset="100%" stopColor="#fff1a9" />
          </linearGradient>
          <linearGradient id="main-site-flame-ember" x1="30%" y1="98%" x2="70%" y2="8%">
            <stop offset="0%" stopColor="#d14b2f" />
            <stop offset="46%" stopColor="#f1b94e" />
            <stop offset="100%" stopColor="#fff8d6" />
          </linearGradient>
          <linearGradient id="main-site-flame-core" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#ffe08a" />
            <stop offset="48%" stopColor="#fff7c4" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="45" rx="22" ry="14" fill="url(#main-site-flame-glow)" className="main-site-flame__glow" />
        <circle cx="43" cy="16" r="1.8" className="main-site-flame__spark main-site-flame__spark--one" />
        <circle cx="22" cy="22" r="1.2" className="main-site-flame__spark main-site-flame__spark--two" />
        <path
          className="main-site-flame__outer"
          fill="url(#main-site-flame-outer)"
          d="M32.4 6.6c4.1 8.1 14.5 13.7 14.5 26.4 0 11-7.1 18.2-14.8 22.4C24.4 51 17.2 43.8 17.2 33c0-6.7 2.8-12.2 7.3-17 2.2-2.4 5.4-5.2 7.9-9.4Z"
        />
        <path
          className="main-site-flame__ember"
          fill="url(#main-site-flame-ember)"
          d="M31.9 15.1c3.1 6.2 9.1 10.2 9.1 18 0 7.4-4.9 12.6-8.8 15.4-4.8-3.2-8.9-8.3-8.9-15.1 0-4.4 1.6-7.9 4.5-11.3 1.3-1.5 2.8-3.3 4.1-7Z"
        />
        <path
          className="main-site-flame__core"
          fill="url(#main-site-flame-core)"
          d="M32 24.3c1.9 3.7 5.5 6 5.5 10.6 0 4.4-2.7 7.4-5.3 9.2-3-2-5.3-5-5.3-9.2 0-2.6 1-4.8 2.6-6.5 1-1.1 1.8-2.3 2.5-4.1Z"
        />
        <path
          className="main-site-flame__shine"
          d="M27.2 24.4c-2.3 3-3.5 5.9-3.1 9.1"
        />
      </svg>
    </span>
  )
}

export function MainSiteLink() {
  const pathname = usePathname()
  const href = normalizeUrl(process.env.NEXT_PUBLIC_MAIN_SITE_URL) || DEFAULT_MAIN_SITE_URL
  const [mobileViewport, setMobileViewport] = useState(false)

  useEffect(() => {
    const updateMobileViewport = () => setMobileViewport(isMobileViewport())

    updateMobileViewport()
    window.addEventListener('resize', updateMobileViewport)
    window.addEventListener('orientationchange', updateMobileViewport)
    return () => {
      window.removeEventListener('resize', updateMobileViewport)
      window.removeEventListener('orientationchange', updateMobileViewport)
    }
  }, [])

  if (pathname?.startsWith('/table/') || pathname?.startsWith('/blackjack/table/') || pathname?.startsWith('/baccarat/table/')) {
    return null
  }

  if (mobileViewport) {
    return null
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="main-site-link fixed left-3 top-3 z-[9998] inline-flex items-center gap-2 rounded-full border border-[#f7d57a]/30 bg-[linear-gradient(135deg,rgba(25,16,10,0.92),rgba(42,24,12,0.86))] px-3 py-2 text-left shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-[#f7d57a]/55 hover:shadow-[0_22px_55px_rgba(0,0,0,0.42)] sm:left-5 sm:top-5"
      aria-label="Open the main Arcana Studio Labs site in a new tab"
    >
      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#f7d57a]/38 bg-[radial-gradient(circle_at_42%_24%,rgba(255,239,174,0.2),rgba(164,87,32,0.12)_46%,rgba(14,8,8,0.5)_100%)] shadow-[inset_0_1px_0_rgba(255,245,201,0.28),0_0_22px_rgba(217,132,48,0.12)]">
        <FlameIcon />
      </span>
      <span className="main-site-link__label hidden min-w-0 sm:block">
        <span className="block text-[10px] uppercase tracking-[0.24em] text-[#f3d2a2]/72">Main site</span>
        <span className="block whitespace-nowrap text-sm font-semibold text-[#fff3e2]">Arcana Studio Labs</span>
      </span>
    </a>
  )
}

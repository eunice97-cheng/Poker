'use client'

import { usePathname } from 'next/navigation'

function isWideCasinoRoute(pathname: string) {
  return (
    pathname === '/lobby' ||
    pathname.startsWith('/table/') ||
    pathname === '/blackjack' ||
    pathname.startsWith('/blackjack/table/')
  )
}

export function LandscapeOnlyGuard() {
  const pathname = usePathname()

  if (!isWideCasinoRoute(pathname)) {
    return null
  }

  return (
    <div className="landscape-only-guard" role="dialog" aria-modal="true" aria-labelledby="landscapeGuardTitle">
      <div className="landscape-only-guard__panel">
        <div className="landscape-only-guard__device" aria-hidden="true">
          <span className="landscape-only-guard__screen" />
          <span className="landscape-only-guard__shine" />
        </div>
        <div className="landscape-only-guard__eyebrow">Casino table view</div>
        <h2 id="landscapeGuardTitle">Rotate your phone</h2>
        <p>
          Poker and BlackJack Lounge are built for a wide table. Turn your device sideways to play.
        </p>
      </div>
    </div>
  )
}

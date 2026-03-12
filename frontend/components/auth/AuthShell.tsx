import type { ReactNode } from 'react'
import { AudioControls } from '@/components/ui/AudioControls'

interface AuthShellProps {
  children: ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#120907] px-4">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-no-repeat"
          style={{
            backgroundImage: "url('/lobby-background/ASL%20Dungeon%20Poker.png')",
            backgroundPosition: 'center top',
            backgroundSize: 'cover',
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,6,5,0.24)_0%,rgba(12,6,5,0.46)_28%,rgba(12,6,5,0.76)_60%,rgba(18,9,7,0.96)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,9,7,0.84)_0%,transparent_18%,transparent_82%,rgba(18,9,7,0.88)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/30 to-transparent" />
        <div className="absolute inset-x-0 top-[22rem] h-56 bg-[radial-gradient(circle,rgba(250,204,21,0.12),transparent_72%)] blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="flex justify-end px-1 pt-5 sm:px-3">
          <AudioControls />
        </div>

        <div className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center py-8">
          {children}
        </div>
      </div>
    </div>
  )
}

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
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,6,5,0.1)_0%,rgba(12,6,5,0.24)_24%,rgba(12,6,5,0.5)_58%,rgba(18,9,7,0.74)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,9,7,0.42)_0%,transparent_16%,transparent_84%,rgba(18,9,7,0.5)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/18 to-transparent" />
        <div className="absolute inset-x-0 top-[21rem] h-52 bg-[radial-gradient(circle,rgba(250,204,21,0.16),transparent_74%)] blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="flex justify-end px-1 pt-5 sm:px-3">
          <AudioControls />
        </div>

        <div className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center py-8">
          <div className="w-full max-w-lg rounded-[32px] border border-[#f3d2a2]/12 bg-[linear-gradient(180deg,rgba(18,9,7,0.48),rgba(18,9,7,0.22))] px-5 py-6 shadow-[0_30px_90px_rgba(0,0,0,0.3)] backdrop-blur-[2px] sm:px-7">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

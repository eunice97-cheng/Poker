import type { ReactNode } from 'react'
import { AudioControls } from '@/components/ui/AudioControls'

interface AuthShellProps {
  children: ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#120907] px-4">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/lobby-background/ASL Dungeon Poker.png"
            alt=""
            aria-hidden="true"
            className="h-auto max-h-[92vh] w-auto max-w-[96vw] object-contain opacity-100 [filter:brightness(1.15)_contrast(1.04)_saturate(1.1)]"
          />
        </div>
      </div>

      <div className="relative z-10">
        <div className="flex justify-end px-1 pt-5 sm:px-3">
          <AudioControls />
        </div>

        <div className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center py-8">
          <div className="w-full max-w-lg rounded-[32px] border border-[#f3d2a2]/14 bg-[linear-gradient(180deg,rgba(18,9,7,0.26),rgba(18,9,7,0.12))] px-5 py-6 shadow-[0_30px_90px_rgba(0,0,0,0.18)] backdrop-blur-[1px] sm:px-7">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

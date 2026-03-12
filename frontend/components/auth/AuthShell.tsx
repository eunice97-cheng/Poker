import type { ReactNode } from 'react'
import { AudioControls } from '@/components/ui/AudioControls'

interface AuthShellProps {
  children: ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#120907] px-4">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 flex justify-center">
          <img
            src="/lobby-background/asl-dungeon-poker.png"
            alt=""
            aria-hidden="true"
            className="h-auto w-full max-w-[1600px] object-contain"
          />
        </div>
      </div>

      <div className="relative z-10">
        <div className="flex justify-end px-1 pt-5 sm:px-3">
          <AudioControls />
        </div>

        <div className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center py-8">
          <div className="w-full max-w-lg rounded-[32px] border border-[#f3d2a2]/14 bg-[linear-gradient(180deg,rgba(18,9,7,0.34),rgba(18,9,7,0.14))] px-5 py-6 shadow-[0_30px_90px_rgba(0,0,0,0.22)] backdrop-blur-[1px] sm:px-7">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

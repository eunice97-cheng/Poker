import Image from 'next/image'
import type { ReactNode } from 'react'
import { AudioControls } from '@/components/ui/AudioControls'
import authBackground from '@/public/lobby-background/asl-dungeon-poker.png'

interface AuthShellProps {
  children: ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#120907]">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 flex justify-center">
        <div className="relative aspect-[19/6] w-full max-w-[2200px]">
          <Image
            src={authBackground}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-contain object-top"
          />
        </div>
      </div>

      <div className="relative z-10 min-h-screen px-4">
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

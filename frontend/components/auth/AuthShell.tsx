import Image from 'next/image'
import type { ReactNode } from 'react'
import { AudioControls } from '@/components/ui/AudioControls'
import authBackground from '@/public/casino-lobby/lobby-background.png'

interface AuthShellProps {
  children: ReactNode
  variant?: 'default' | 'login'
}

export function AuthShell({ children, variant = 'default' }: AuthShellProps) {
  return (
    <div className={`auth-shell auth-shell--${variant} relative min-h-screen overflow-hidden bg-[#120907]`}>
      <div className="auth-shell__backdrop pointer-events-none fixed inset-0 z-0">
        <Image
          src={authBackground}
          alt=""
          fill
          priority
          sizes="100vw"
          className="auth-shell__image object-cover"
        />
        {variant === 'login' && (
          <Image
            src="/auth/desktop-login-frame.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="auth-shell__desktop-frame hidden object-cover"
          />
        )}
        <div className="auth-shell__veil absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(94,52,27,0.28),rgba(7,4,3,0.66)_56%,rgba(0,0,0,0.86)_100%)]" />
      </div>

      <div className="auth-shell__content relative z-10 min-h-screen px-4">
        <div className="auth-shell__audio flex justify-end px-1 pt-5 sm:px-3">
          <AudioControls />
        </div>

        <div className="auth-shell__stage flex min-h-[calc(100vh-4.5rem)] items-center justify-center py-8">
          <div className="auth-shell__panel w-full max-w-lg rounded-[32px] border border-[#f3d2a2]/14 bg-[linear-gradient(180deg,rgba(18,9,7,0.34),rgba(18,9,7,0.14))] px-5 py-6 shadow-[0_30px_90px_rgba(0,0,0,0.22)] backdrop-blur-[1px] sm:px-7">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

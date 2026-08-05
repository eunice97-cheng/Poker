import Image from 'next/image'
import casinoLogo from '@/public/casino-lobby/logo.png'

export function AuthBrandMark() {
  return (
    <div className="auth-brand-mark relative mx-auto h-20 w-28">
      <Image
        src={casinoLogo}
        alt="ASL Gaming Casino"
        fill
        priority
        sizes="112px"
        className="object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.62)]"
      />
    </div>
  )
}

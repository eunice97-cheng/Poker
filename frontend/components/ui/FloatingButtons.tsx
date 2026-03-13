'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const baseButtonClasses =
  'group relative flex items-center overflow-hidden rounded-full text-sm font-semibold text-white transition-all duration-300 hover:scale-105 active:scale-95'

const compactButtonClasses =
  'h-10 w-14 justify-center px-0 sm:h-11 sm:w-14 md:w-14 md:justify-center md:px-0 md:hover:w-[178px] md:hover:justify-start md:hover:px-3'

const discordClasses =
  `${baseButtonClasses} ${compactButtonClasses}`

const supportButtonClasses =
  `${baseButtonClasses} h-10 w-14 justify-center px-0 sm:h-11 sm:w-14 md:w-14 md:justify-center md:px-0 md:hover:w-[168px] md:hover:justify-start md:hover:px-3`

const redeemClasses =
  `${baseButtonClasses} ${compactButtonClasses}`

const buttonImageClasses = 'relative z-10 h-14 w-14 flex-shrink-0 object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.38)]'

const buttonLabelClasses =
  'relative z-10 hidden whitespace-nowrap pl-2 opacity-0 transition-all duration-300 [text-shadow:0_2px_10px_rgba(0,0,0,0.55)] md:inline md:max-w-0 md:translate-x-1 md:overflow-hidden md:group-hover:translate-x-0 md:group-hover:opacity-100'

const DONATION_REWARDS = [
  { amount: '$5', reward: '5,000 chips' },
  { amount: '$10', reward: '12,000 chips' },
  { amount: '$15', reward: '20,000 chips' },
  { amount: '$20', reward: '27,000 chips' },
  { amount: '$25', reward: '35,000 chips' },
]

const MEMBERSHIP_REWARDS = [
  { amount: '$5/mo', reward: '6,000 chips' },
  { amount: '$10/mo', reward: '15,000 chips' },
  { amount: '$25/mo', reward: '45,000 chips' },
]

function ButtonIcon({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={56}
      height={56}
      className={buttonImageClasses}
    />
  )
}

function GoldRim() {
  return null
}

export function FloatingButtons() {
  const [supportOpen, setSupportOpen] = useState(false)
  const supportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!supportRef.current?.contains(event.target as Node)) {
        setSupportOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  return (
    <div className="fixed right-3 top-16 z-[9999] flex select-none flex-col items-end gap-2 md:right-5 md:top-24">
      <Link
        href="/redeem"
        className={redeemClasses}
        title="Redeem a chip code"
      >
        <GoldRim />
        <ButtonIcon src="/buttons/chip.png" />
        <span className={`${buttonLabelClasses} md:group-hover:max-w-[120px]`}>
          Redeem Code
        </span>
      </Link>

      <a
        href="https://discord.com/users/909063517280296961"
        target="_blank"
        rel="noopener noreferrer"
        className={discordClasses}
        title="Open Discord and ping the host"
      >
        <GoldRim />
        <ButtonIcon src="/buttons/bell.png" />
        <span className={`${buttonLabelClasses} md:group-hover:max-w-[120px]`}>
          Ping the Host
        </span>
      </a>

      <div
        ref={supportRef}
        className="relative flex flex-col items-end"
      >
        <button
          type="button"
          className={supportButtonClasses}
          title="Support the host on Ko-fi"
          onClick={() => setSupportOpen((open) => !open)}
          aria-expanded={supportOpen}
          aria-controls="support-pill"
        >
          <GoldRim />
          <ButtonIcon src="/buttons/drink.png" />
          <span className={`${buttonLabelClasses} md:group-hover:max-w-[124px]`}>
            Tip the Host
          </span>
        </button>

        <div
          id="support-pill"
          className={`absolute right-0 top-14 max-h-[min(78vh,38rem)] w-[320px] overflow-y-auto rounded-[28px] border border-[#f7d57a]/20 bg-[linear-gradient(180deg,rgba(17,24,39,0.96),rgba(10,15,24,0.98))] p-4 text-left shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-200 ${
            supportOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-[#9cead8]">Support rewards</div>
              <h3 className="mt-2 font-serif text-2xl text-[#fff3e2]">Tip the host, get a code by email.</h3>
            </div>
            <button
              type="button"
              onClick={() => setSupportOpen(false)}
              className="rounded-full border border-white/10 px-2 py-1 text-xs text-white/55 transition-colors hover:text-white"
            >
              Close
            </button>
          </div>

          <p className="mt-3 text-sm leading-6 text-white/70">
            Support on Ko-fi, then redeem the emailed code in the poker room. Use support language in public copy, not chip purchase language.
          </p>

          <div className="mt-4 grid gap-3">
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-3">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#f3d2a2]/48">One-time support</div>
              <div className="mt-3 space-y-2">
                {DONATION_REWARDS.map((tier) => (
                  <div key={tier.amount} className="flex items-center justify-between rounded-full border border-white/6 bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="font-semibold text-[#fff3e2]">{tier.amount}</span>
                    <span className="text-[#9cead8]">{tier.reward}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-black/20 p-3">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#f3d2a2]/48">Monthly membership</div>
              <div className="mt-3 space-y-2">
                {MEMBERSHIP_REWARDS.map((tier) => (
                  <div key={tier.amount} className="flex items-center justify-between rounded-full border border-white/6 bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="font-semibold text-[#fff3e2]">{tier.amount}</span>
                    <span className="text-[#9cead8]">{tier.reward}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[22px] border border-[#f7d57a]/12 bg-[#f1b45b]/[0.08] p-3 text-sm text-[#ffe9bf]">
            After support is confirmed, a redeem code is emailed to you. Enter it on the <Link href="/redeem" className="font-semibold text-[#fff3e2] underline decoration-[#f7d57a]/50 underline-offset-4">Redeem page</Link>.
          </div>

          <a
            href="https://ko-fi.com/eunicecheng"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#f3c667,#e39a2f)] px-4 py-3 text-sm font-bold text-[#1d1208] transition-transform duration-200 hover:scale-[1.02]"
          >
            Open Ko-fi
          </a>
        </div>
      </div>
    </div>
  )
}

'use client'

import Image from 'next/image'

interface CardProps {
  card: string   // e.g. 'Ah', 'Kd', '??' for hidden
  size?: 'sm' | 'md' | 'lg'
  className?: string
  backImage?: string
}

const suitSymbols: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' }
const suitColors: Record<string, string> = { h: 'text-red-500', d: 'text-red-500', c: 'text-gray-900', s: 'text-gray-900' }

const sizeClasses = {
  sm: 'w-10 h-14 text-sm',
  md: 'w-14 h-20 text-base',
  lg: 'w-16 h-24 text-lg',
}

export function CardComponent({ card, size = 'md', className = '', backImage }: CardProps) {
  if (card === '??') {
    return (
      <div className={`${sizeClasses[size]} ${className} relative overflow-hidden bg-blue-800 border-2 border-blue-600 rounded-lg flex items-center justify-center shadow-lg`}>
        {backImage ? (
          <Image
            src={backImage}
            alt="Card back"
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : null}
        <div className={`absolute inset-0 ${backImage ? 'bg-black/10' : 'bg-blue-900/30'}`} />
        {!backImage ? (
          <span className="relative z-10 text-blue-100 text-xl font-bold">?</span>
        ) : null}
      </div>
    )
  }

  const rank = card.slice(0, -1)
  const suit = card.slice(-1)
  const symbol = suitSymbols[suit] ?? suit
  const color = suitColors[suit] ?? 'text-gray-900'
  const displayRank = rank === 'T' ? '10' : rank

  return (
    <div className={`${sizeClasses[size]} ${className} bg-white border-2 border-gray-200 rounded-lg flex flex-col items-center justify-between p-1 shadow-lg select-none`}>
      <span className={`${color} font-bold leading-none self-start text-xs`}>{displayRank}</span>
      <span className={`${color} text-xl leading-none`}>{symbol}</span>
      <span className={`${color} font-bold leading-none self-end text-xs rotate-180`}>{displayRank}</span>
    </div>
  )
}

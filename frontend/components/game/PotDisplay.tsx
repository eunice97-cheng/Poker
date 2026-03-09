'use client'

import { SidePot } from '@/types/poker'

interface PotDisplayProps {
  pot: number
  sidePots: SidePot[]
}

export function PotDisplay({ pot, sidePots }: PotDisplayProps) {
  if (sidePots.length <= 1) {
    return (
      <div className="text-center">
        <span className="text-yellow-400 font-bold text-xl">{pot.toLocaleString()}</span>
        <span className="text-gray-500 text-sm ml-1">chips</span>
      </div>
    )
  }

  return (
    <div className="text-center space-y-1">
      <div>
        <span className="text-yellow-400 font-bold">{pot.toLocaleString()}</span>
        <span className="text-gray-500 text-xs ml-1">total pot</span>
      </div>
      {sidePots.map((sp, i) => (
        <div key={i} className="text-sm">
          <span className="text-orange-400">{sp.amount.toLocaleString()}</span>
          <span className="text-gray-600 text-xs ml-1">side pot {i + 1}</span>
        </div>
      ))}
    </div>
  )
}

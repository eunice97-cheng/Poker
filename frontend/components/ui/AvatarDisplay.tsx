'use client'

import Image from 'next/image'
import { getAvatar } from '@/lib/avatars'

interface AvatarDisplayProps {
  avatarId: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizePx = {
  sm: 36,
  md: 48,
  lg: 64,
  xl: 80,
}

const sizeClasses = {
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20',
}

export function AvatarDisplay({ avatarId, size = 'md', className = '' }: AvatarDisplayProps) {
  const avatar = getAvatar(avatarId)
  const px = sizePx[size]
  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-lg overflow-hidden border-2 border-gray-600
        flex-shrink-0 bg-gray-800
        select-none transition-all
        ${className}
      `}
    >
      <Image
        src={avatar.image}
        alt={avatar.label}
        width={px}
        height={px}
        className="w-full h-full object-cover"
      />
    </div>
  )
}

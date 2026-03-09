'use client'

import { getAvatar } from '@/lib/avatars'

interface AvatarDisplayProps {
  avatarId: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'w-9 h-9 text-lg',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-16 h-16 text-3xl',
  xl: 'w-20 h-20 text-4xl',
}

export function AvatarDisplay({ avatarId, size = 'md', className = '' }: AvatarDisplayProps) {
  const avatar = getAvatar(avatarId)
  return (
    <div
      className={`
        ${sizeClasses[size]}
        ${avatar.bg} border-2 ${avatar.border}
        rounded-full flex items-center justify-center
        select-none transition-all
        ${className}
      `}
    >
      {avatar.symbol}
    </div>
  )
}

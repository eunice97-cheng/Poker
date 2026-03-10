export interface AvatarOption {
  id: string
  image: string
  label: string
}

export const AVATARS: AvatarOption[] = [
  { id: 'avatar_m1', image: '/avatars/M1.png', label: 'Male 1' },
  { id: 'avatar_m2', image: '/avatars/M2.png', label: 'Male 2' },
  { id: 'avatar_m3', image: '/avatars/M3.png', label: 'Male 3' },
  { id: 'avatar_m4', image: '/avatars/M4.png', label: 'Male 4' },
  { id: 'avatar_m5', image: '/avatars/M5.png', label: 'Male 5' },
  { id: 'avatar_m6', image: '/avatars/M6.png', label: 'Male 6' },
  { id: 'avatar_f1', image: '/avatars/F1.png', label: 'Female 1' },
  { id: 'avatar_f2', image: '/avatars/F2.png', label: 'Female 2' },
  { id: 'avatar_f3', image: '/avatars/F3.png', label: 'Female 3' },
  { id: 'avatar_f4', image: '/avatars/F4.png', label: 'Female 4' },
  { id: 'avatar_f5', image: '/avatars/F5.png', label: 'Female 5' },
  { id: 'avatar_f6', image: '/avatars/F6.png', label: 'Female 6' },
]

export function getAvatar(id: string): AvatarOption {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]
}

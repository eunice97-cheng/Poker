export interface AvatarOption {
  id: string
  image: string
  label: string
  adminOnly?: boolean
}

const buildAvatarSet = (prefix: 'm' | 'f', label: 'Male' | 'Female') =>
  Array.from({ length: 12 }, (_, index) => {
    const number = index + 1
    return {
      id: `avatar_${prefix}${number}`,
      image: `/avatars/${prefix.toUpperCase()}${number}.png`,
      label: `${label} ${number}`,
    }
  })

export const AVATARS: AvatarOption[] = [
  ...buildAvatarSet('m', 'Male'),
  ...buildAvatarSet('f', 'Female'),
  { id: 'avatar_gm', image: '/avatars/GM.png', label: 'GM', adminOnly: true },
  { id: 'ai_alice', image: '/avatars/ai/Alice.png', label: 'Alice' },
  { id: 'ai_bernice', image: '/avatars/ai/Bernice.png', label: 'Bernice' },
  { id: 'ai_candice', image: '/avatars/ai/Candice.png', label: 'Candice' },
  { id: 'ai_denice', image: '/avatars/ai/Denice.png', label: 'Denice' },
  { id: 'ai_felice', image: '/avatars/ai/Felice.png', label: 'Felice' },
  { id: 'ai_gillece', image: '/avatars/ai/Gillece.png', label: 'Gillece' },
]

export function getAvatar(id: string): AvatarOption {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]
}

export function getSelectableAvatars(isAdmin: boolean): AvatarOption[] {
  return AVATARS.filter((avatar) => !avatar.id.startsWith('ai_') && (isAdmin || !avatar.adminOnly))
}

export function isAvatarSelectable(id: string, isAdmin: boolean): boolean {
  return getSelectableAvatars(isAdmin).some((avatar) => avatar.id === id)
}

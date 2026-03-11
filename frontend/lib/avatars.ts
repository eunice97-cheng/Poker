export interface AvatarOption {
  id: string
  image: string
  label: string
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

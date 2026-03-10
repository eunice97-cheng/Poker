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
]

export function getAvatar(id: string): AvatarOption {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]
}

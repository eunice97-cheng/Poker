export interface AvatarOption {
  id: string
  symbol: string
  bg: string
  border: string
  label: string
}

export const AVATARS: AvatarOption[] = [
  { id: 'avatar_1',  symbol: '♠', bg: 'bg-gray-800',   border: 'border-gray-500',  label: 'Spade' },
  { id: 'avatar_2',  symbol: '♥', bg: 'bg-red-900',    border: 'border-red-500',   label: 'Heart' },
  { id: 'avatar_3',  symbol: '♦', bg: 'bg-orange-900', border: 'border-orange-500',label: 'Diamond' },
  { id: 'avatar_4',  symbol: '♣', bg: 'bg-green-900',  border: 'border-green-500', label: 'Club' },
  { id: 'avatar_5',  symbol: '🂱', bg: 'bg-yellow-900', border: 'border-yellow-500',label: 'Ace' },
  { id: 'avatar_6',  symbol: '👑', bg: 'bg-purple-900', border: 'border-purple-500',label: 'King' },
  { id: 'avatar_7',  symbol: '🎰', bg: 'bg-pink-900',   border: 'border-pink-500',  label: 'Slots' },
  { id: 'avatar_8',  symbol: '🃏', bg: 'bg-blue-900',   border: 'border-blue-500',  label: 'Joker' },
  { id: 'avatar_9',  symbol: '🦁', bg: 'bg-amber-900',  border: 'border-amber-500', label: 'Lion' },
  { id: 'avatar_10', symbol: '🐺', bg: 'bg-slate-800',  border: 'border-slate-500', label: 'Wolf' },
  { id: 'avatar_11', symbol: '🦊', bg: 'bg-red-800',    border: 'border-red-400',   label: 'Fox' },
  { id: 'avatar_12', symbol: '🐉', bg: 'bg-emerald-900',border: 'border-emerald-500',label: 'Dragon' },
]

export function getAvatar(id: string): AvatarOption {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]
}

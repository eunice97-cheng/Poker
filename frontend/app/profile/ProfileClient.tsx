'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AVATARS, getAvatar } from '@/lib/avatars'
import { Button } from '@/components/ui/Button'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'

interface HandRecord {
  id: string
  hand_number: number
  community: string[]
  pot_total: number
  winners: { playerId: string; username: string; amount: number; handRank: string }[]
  ended_at: string
}

interface ProfileClientProps {
  initialProfile: {
    id: string
    username: string
    chip_balance: number
    games_played: number
    games_won: number
    avatar: string
    created_at: string
  } | null
  handHistory: HandRecord[]
  userId: string
  email: string
}

export function ProfileClient({ initialProfile, handHistory, userId, email }: ProfileClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const username = initialProfile?.username ?? ''
  const [selectedAvatar, setSelectedAvatar] = useState(initialProfile?.avatar ?? 'avatar_m1')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [error, setError] = useState('')
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)

  const profile = initialProfile
  const winRate = profile && profile.games_played > 0
    ? Math.round((profile.games_won / profile.games_played) * 100)
    : 0

  const isDirty = !profile || selectedAvatar !== profile.avatar

  const handleSave = async () => {
    if (!isDirty) return
    setSaving(true)
    setError('')
    setSaveMsg('')

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar: selectedAvatar })
      .eq('id', userId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSaveMsg('Saved!')
      router.refresh()
      setTimeout(() => setSaveMsg(''), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/lobby" className="text-gray-400 hover:text-white text-sm transition-colors">
            ← Back to Lobby
          </Link>
          <h1 className="text-lg font-bold text-white">My Profile</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Profile Card */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-5">Profile Settings</h2>

          {/* Avatar + Name row */}
          <div className="flex items-center gap-5 mb-6">
            {/* Avatar button */}
            <button
              onClick={() => setShowAvatarPicker((v) => !v)}
              className="relative group flex-shrink-0"
              title="Change avatar"
            >
              <AvatarDisplay avatarId={selectedAvatar} size="xl" />
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-bold">Change</span>
              </div>
            </button>

            <div className="flex-1">
              <label className="block text-gray-400 text-sm mb-1">Player Name</label>
              <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white">
                {username || <span className="text-gray-500">Not set</span>}
              </div>
              <p className="text-gray-600 text-xs mt-1">{email}</p>
            </div>
          </div>

          {/* Avatar Picker */}
          {showAvatarPicker && (
            <div className="mb-6 p-4 bg-gray-800/60 rounded-xl border border-gray-700">
              <p className="text-gray-400 text-sm mb-3">Choose your avatar</p>
              <div className="grid grid-cols-6 gap-3">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => { setSelectedAvatar(avatar.id); setShowAvatarPicker(false) }}
                    title={avatar.label}
                    className={`relative rounded-full transition-all hover:scale-110 ${
                      selectedAvatar === avatar.id ? 'ring-2 ring-yellow-400 scale-110' : ''
                    }`}
                  >
                    <AvatarDisplay avatarId={avatar.id} size="md" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Save */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              disabled={!isDirty}
            >
              Save Changes
            </Button>
            {saveMsg && <span className="text-green-400 text-sm">{saveMsg}</span>}
            {error && <span className="text-red-400 text-sm">{error}</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-5">Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Chip Balance', value: profile?.chip_balance.toLocaleString() ?? '0', color: 'text-yellow-400' },
              { label: 'Games Played', value: profile?.games_played ?? 0, color: 'text-white' },
              { label: 'Wins',         value: profile?.games_won ?? 0,    color: 'text-green-400' },
              { label: 'Win Rate',     value: `${winRate}%`,              color: 'text-blue-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-800/60 rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-gray-500 text-sm mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hand History */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-5">Recent Hands</h2>

          {handHistory.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No hands played yet — go join a table!</p>
          ) : (
            <div className="space-y-2">
              {handHistory.map((hand) => {
                const isWinner = hand.winners?.some((w) => w.playerId === userId)
                const myWin = hand.winners?.find((w) => w.playerId === userId)
                return (
                  <div key={hand.id} className="flex items-center justify-between bg-gray-800/40 rounded-xl px-4 py-3 text-sm">
                    <div className="flex items-center gap-4">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isWinner ? 'bg-green-400' : 'bg-gray-600'}`} />
                      <div>
                        <span className="text-gray-400">Hand #{hand.hand_number}</span>
                        <span className="text-gray-600 mx-2">·</span>
                        <span className="text-gray-500 text-xs">{new Date(hand.ended_at).toLocaleDateString()}</span>
                      </div>
                      {hand.community?.length > 0 && (
                        <span className="text-gray-600 text-xs hidden md:block">{hand.community.join(' ')}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs">Pot: {hand.pot_total?.toLocaleString()}</span>
                      <span className={`font-bold ${isWinner ? 'text-green-400' : 'text-gray-600'}`}>
                        {isWinner ? `+${myWin?.amount?.toLocaleString()}` : 'Lost'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sign out */}
        <div className="text-center pb-4">
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/auth/login')
            }}
            className="text-gray-600 hover:text-red-400 text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  )
}

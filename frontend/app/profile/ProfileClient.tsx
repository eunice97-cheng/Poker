'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AVATARS } from '@/lib/avatars'
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

type Tab = 'profile' | 'stats' | 'hands'

export function ProfileClient({ initialProfile, handHistory, userId, email }: ProfileClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const username = initialProfile?.username ?? ''
  const [selectedAvatar, setSelectedAvatar] = useState(initialProfile?.avatar ?? 'avatar_m1')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('profile')

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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile Settings' },
    { id: 'stats', label: 'Stats' },
    { id: 'hands', label: 'Recent Hands' },
  ]

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

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* Tab Bar */}
        <div className="flex gap-1 bg-gray-900 border border-gray-700 rounded-xl p-1 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-yellow-500 text-gray-900'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Profile Settings */}
        {activeTab === 'profile' && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-6">

            {/* Avatar + Name row */}
            <div className="flex items-center gap-5">
              <div className="flex-shrink-0">
                <AvatarDisplay avatarId={selectedAvatar} size="xl" />
              </div>
              <div className="flex-1">
                <label className="block text-gray-400 text-sm mb-1">Player Name</label>
                <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white">
                  {username || <span className="text-gray-500">Not set</span>}
                </div>
                <p className="text-gray-600 text-xs mt-1">{email}</p>
              </div>
            </div>

            {/* Avatar Picker */}
            <div>
              <p className="text-gray-400 text-sm mb-3">Choose your avatar</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <p className="text-gray-500 text-xs text-center">Male</p>
                <p className="text-gray-500 text-xs text-center">Female</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4, 5, 6].map((n) => {
                  const male = AVATARS.find((a) => a.id === `avatar_m${n}`)!
                  const female = AVATARS.find((a) => a.id === `avatar_f${n}`)!
                  return [male, female].map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar.id)}
                      title={avatar.label}
                      className={`block rounded-xl transition-all hover:scale-105 ${
                        selectedAvatar === avatar.id
                          ? 'ring-[3px] ring-yellow-400 ring-offset-2 ring-offset-gray-900 scale-105'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <AvatarDisplay avatarId={avatar.id} size="2xl" className="w-full" />
                    </button>
                  ))
                })}
              </div>
            </div>

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
        )}

        {/* Tab: Stats */}
        {activeTab === 'stats' && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-8">
              <AvatarDisplay avatarId={selectedAvatar} size="xl" />
              <div>
                <div className="text-white text-xl font-bold">{username}</div>
                <div className="text-yellow-400 font-bold">{profile?.chip_balance.toLocaleString() ?? '0'} chips</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Games Played', value: profile?.games_played ?? 0, color: 'text-white' },
                { label: 'Wins', value: profile?.games_won ?? 0, color: 'text-green-400' },
                { label: 'Win Rate', value: `${winRate}%`, color: 'text-blue-400' },
                { label: 'Member Since', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—', color: 'text-gray-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-800/60 rounded-xl p-5 text-center">
                  <div className={`text-3xl font-bold ${color}`}>{value}</div>
                  <div className="text-gray-500 text-sm mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Recent Hands */}
        {activeTab === 'hands' && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
            {handHistory.length === 0 ? (
              <p className="text-gray-600 text-center py-12">No hands played yet — go join a table!</p>
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
        )}

        {/* Sign out */}
        <div className="text-center pt-6">
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

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { Button } from '@/components/ui/Button'
import { MailIcon } from '@/components/ui/MailIcon'
import { getSelectableAvatars, isAvatarSelectable } from '@/lib/avatars'
import { createClient } from '@/lib/supabase/client'
import {
  WEEKEND_LOYALTY_CHIPS,
  formatUtcDateTime,
  getWeekendLoyaltyStatus,
  type WeekendLoyaltyStatus,
} from '@/lib/weekend-loyalty'

interface HandRecord {
  id: string
  hand_number: number
  community: string[]
  pot_total: number
  winners: { playerId: string; username: string; amount: number; handRank: string }[]
  ended_at: string
}

interface PlayerMailItem {
  id: string
  category: 'system' | 'reward'
  subject: string
  body: string
  is_read: boolean
  created_at: string
}

interface ProfileRecord {
  id: string
  username: string
  chip_balance: number
  games_played: number
  games_won: number
  avatar: string
  created_at: string
  last_weekend_loyalty_claim_at: string | null
}

type Tab = 'profile' | 'stats' | 'hands' | 'mail'

interface ProfileClientProps {
  initialProfile: ProfileRecord | null
  initialLoyaltyStatus: WeekendLoyaltyStatus
  initialMail: PlayerMailItem[]
  initialUnreadMailCount: number
  initialTab: Tab
  handHistory: HandRecord[]
  userId: string
  email: string
  isAdmin: boolean
}

export function ProfileClient({
  initialProfile,
  initialLoyaltyStatus,
  initialMail,
  initialUnreadMailCount,
  initialTab,
  handHistory,
  userId,
  email,
  isAdmin,
}: ProfileClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const profile = initialProfile
  const selectableAvatars = getSelectableAvatars(isAdmin)
  const currentAvatar = isAvatarSelectable(profile?.avatar ?? 'avatar_m1', isAdmin)
    ? (profile?.avatar ?? 'avatar_m1')
    : 'avatar_m1'
  const username = profile?.username ?? ''
  const winRate = profile && profile.games_played > 0
    ? Math.round((profile.games_won / profile.games_played) * 100)
    : 0

  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar)
  const [chipBalance, setChipBalance] = useState(profile?.chip_balance ?? 0)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [loyaltyStatus, setLoyaltyStatus] = useState(initialLoyaltyStatus)
  const [claimingLoyalty, setClaimingLoyalty] = useState(false)
  const [loyaltyMessage, setLoyaltyMessage] = useState('')
  const [loyaltyError, setLoyaltyError] = useState('')
  const [mailItems, setMailItems] = useState(initialMail)
  const [unreadMailCount, setUnreadMailCount] = useState(initialUnreadMailCount)
  const [markingMailRead, setMarkingMailRead] = useState(false)

  const isDirty = !profile || selectedAvatar !== currentAvatar
  const loyaltySummary = loyaltyStatus.canClaim
    ? `Weekend reward live now. Claim it before ${formatUtcDateTime(loyaltyStatus.windowEnd)}.`
    : loyaltyStatus.alreadyClaimed
      ? `This weekend reward is already in your account. The next claim opens ${formatUtcDateTime(loyaltyStatus.nextClaimAt)}.`
      : `The next weekend reward opens ${formatUtcDateTime(loyaltyStatus.nextClaimAt)}.`
  const loyaltyPillClass = loyaltyStatus.canClaim
    ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
    : loyaltyStatus.alreadyClaimed
      ? 'border-yellow-400/25 bg-yellow-400/10 text-yellow-100'
      : 'border-white/10 bg-white/5 text-gray-300'
  const loyaltyButtonLabel = loyaltyStatus.canClaim
    ? `Collect ${WEEKEND_LOYALTY_CHIPS.toLocaleString()} Chips`
    : loyaltyStatus.alreadyClaimed
      ? 'Claimed This Weekend'
      : 'Weekend Only'

  useEffect(() => {
    if (activeTab !== 'mail' || unreadMailCount === 0) {
      return
    }

    let cancelled = false

    async function markMailRead() {
      setMarkingMailRead(true)

      try {
        const res = await fetch('/api/profile/mail/read', { method: 'POST' })
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data.error ?? 'Failed to mark mail as read')
        }

        if (!cancelled) {
          setUnreadMailCount(0)
          setMailItems((current) => current.map((item) => ({ ...item, is_read: true })))
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) {
          setMarkingMailRead(false)
        }
      }
    }

    void markMailRead()

    return () => {
      cancelled = true
    }
  }, [activeTab, unreadMailCount])

  const handleSave = async () => {
    if (!isDirty) return
    setSaving(true)
    setError('')
    setSaveMsg('')

    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: selectedAvatar }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to save avatar')
      }

      setSaveMsg('Saved!')
      router.refresh()
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save avatar')
    } finally {
      setSaving(false)
    }
  }

  const handleClaimLoyalty = async () => {
    setClaimingLoyalty(true)
    setLoyaltyError('')
    setLoyaltyMessage('')

    try {
      const res = await fetch('/api/profile/weekend-loyalty', { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to claim weekend loyalty bonus')
      }

      const claimedAt = typeof data.claimedAt === 'string' ? data.claimedAt : new Date().toISOString()
      const nextClaimAt = typeof data.nextClaimAt === 'string'
        ? data.nextClaimAt
        : getWeekendLoyaltyStatus(claimedAt).nextClaimAt

      setChipBalance(Number(data.newBalance ?? chipBalance + WEEKEND_LOYALTY_CHIPS))
      setLoyaltyStatus(getWeekendLoyaltyStatus(claimedAt))
      setLoyaltyMessage(
        `${WEEKEND_LOYALTY_CHIPS.toLocaleString()} chips added. Next weekend reward opens ${formatUtcDateTime(nextClaimAt)}.`
      )

      if (data.mail) {
        setMailItems((current) => [data.mail as PlayerMailItem, ...current.filter((item) => item.id !== data.mail.id)])
        setUnreadMailCount((current) => current + ((data.mail as PlayerMailItem).is_read ? 0 : 1))
      }
    } catch (err) {
      setLoyaltyError(err instanceof Error ? err.message : 'Failed to claim weekend loyalty bonus')
    } finally {
      setClaimingLoyalty(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile Settings' },
    { id: 'stats', label: 'Stats' },
    { id: 'hands', label: 'Recent Hands' },
    { id: 'mail', label: unreadMailCount > 0 ? `Mail (${unreadMailCount})` : 'Mail' },
  ]

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="sticky top-0 z-20 border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/lobby" className="text-sm text-gray-400 transition-colors hover:text-white">
            Back to Lobby
          </Link>
          <h1 className="text-lg font-bold text-white">My Profile</h1>
          <Link
            href="/profile?tab=mail"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-gray-300 transition-colors hover:border-yellow-400/40 hover:text-white"
            title="Open mailbox"
            aria-label="Open mailbox"
          >
            <MailIcon className="h-4.5 w-4.5" />
            <span className="sr-only">Mailbox</span>
            {unreadMailCount > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-[0_0_18px_rgba(239,68,68,0.35)]">
                {unreadMailCount > 99 ? '99+' : unreadMailCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex gap-1 rounded-xl border border-gray-700 bg-gray-900 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-yellow-500 text-gray-900'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'profile' && (
          <div className="space-y-6 rounded-2xl border border-gray-700 bg-gray-900 p-6">
            <div className="flex items-center gap-5">
              <div className="flex-shrink-0">
                <AvatarDisplay avatarId={selectedAvatar} size="xl" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm text-gray-400">Player Name</label>
                <div className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-white">
                  {username || <span className="text-gray-500">Not set</span>}
                </div>
                <p className="mt-1 text-xs text-gray-600">{email}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-yellow-400/20 bg-[linear-gradient(180deg,rgba(234,179,8,0.14),rgba(24,24,27,0.45))] p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-xl">
                  <div className="text-[11px] uppercase tracking-[0.3em] text-yellow-200/72">Weekend loyalty</div>
                  <h2 className="mt-2 text-xl font-semibold text-white">Registered players can collect 1,000 free chips every weekend.</h2>
                  <p className="mt-3 text-sm leading-6 text-gray-200">{loyaltySummary}</p>
                  <p className="mt-2 text-xs text-gray-400">Claim window runs from Saturday 12:00 AM UTC through Monday 12:00 AM UTC.</p>
                </div>

                <div className={`min-w-[220px] rounded-2xl border p-4 ${loyaltyPillClass}`}>
                  <div className="text-[11px] uppercase tracking-[0.26em]">Reward</div>
                  <div className="mt-2 text-3xl font-bold text-yellow-300">+{WEEKEND_LOYALTY_CHIPS.toLocaleString()}</div>
                  <div className="text-sm">free chips</div>
                  <Button
                    variant="primary"
                    className="mt-4 w-full"
                    onClick={handleClaimLoyalty}
                    loading={claimingLoyalty}
                    disabled={!loyaltyStatus.canClaim}
                  >
                    {loyaltyButtonLabel}
                  </Button>
                </div>
              </div>

              {loyaltyMessage && <p className="mt-4 text-sm text-emerald-300">{loyaltyMessage}</p>}
              {loyaltyError && <p className="mt-4 text-sm text-red-300">{loyaltyError}</p>}
            </div>

            <div>
              <p className="mb-3 text-sm text-gray-400">Choose your avatar</p>
              <div className="grid grid-cols-4 justify-items-center gap-4">
                {selectableAvatars.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => setSelectedAvatar(avatar.id)}
                    title={avatar.label}
                    className={`block rounded-xl transition-all hover:scale-105 ${
                      selectedAvatar === avatar.id
                        ? 'scale-105 ring-[3px] ring-yellow-400 ring-offset-2 ring-offset-gray-900'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <AvatarDisplay avatarId={avatar.id} size="2xl" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={handleSave} loading={saving} disabled={!isDirty}>
                Save Changes
              </Button>
              {saveMsg && <span className="text-sm text-green-400">{saveMsg}</span>}
              {error && <span className="text-sm text-red-400">{error}</span>}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="rounded-2xl border border-gray-700 bg-gray-900 p-6">
            <div className="mb-8 flex items-center gap-4">
              <AvatarDisplay avatarId={selectedAvatar} size="xl" />
              <div>
                <div className="text-xl font-bold text-white">{username}</div>
                <div className="font-bold text-yellow-400">{chipBalance.toLocaleString()} chips</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Games Played', value: profile?.games_played ?? 0, color: 'text-white' },
                { label: 'Wins', value: profile?.games_won ?? 0, color: 'text-green-400' },
                { label: 'Win Rate', value: `${winRate}%`, color: 'text-blue-400' },
                {
                  label: 'Member Since',
                  value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '-',
                  color: 'text-gray-400',
                },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl bg-gray-800/60 p-5 text-center">
                  <div className={`text-3xl font-bold ${color}`}>{value}</div>
                  <div className="mt-1 text-sm text-gray-500">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'hands' && (
          <div className="rounded-2xl border border-gray-700 bg-gray-900 p-6">
            {handHistory.length === 0 ? (
              <p className="py-12 text-center text-gray-600">No hands played yet - go join a table.</p>
            ) : (
              <div className="space-y-2">
                {handHistory.map((hand) => {
                  const isWinner = hand.winners?.some((winner) => winner.playerId === userId)
                  const myWin = hand.winners?.find((winner) => winner.playerId === userId)

                  return (
                    <div key={hand.id} className="flex items-center justify-between rounded-xl bg-gray-800/40 px-4 py-3 text-sm">
                      <div className="flex items-center gap-4">
                        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${isWinner ? 'bg-green-400' : 'bg-gray-600'}`} />
                        <div>
                          <span className="text-gray-400">Hand #{hand.hand_number}</span>
                          <span className="mx-2 text-gray-600">-</span>
                          <span className="text-xs text-gray-500">{new Date(hand.ended_at).toLocaleDateString()}</span>
                        </div>
                        {hand.community?.length > 0 && (
                          <span className="hidden text-xs text-gray-600 md:block">{hand.community.join(' ')}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">Pot: {hand.pot_total?.toLocaleString()}</span>
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

        {activeTab === 'mail' && (
          <div className="rounded-2xl border border-gray-700 bg-gray-900 p-6">
            <div className="mb-5 flex flex-col gap-2 border-b border-gray-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Mailbox</h2>
                <p className="mt-1 text-sm text-gray-400">Reward notices and system messages stay here in the browser.</p>
              </div>
              <div className="text-xs uppercase tracking-[0.24em] text-gray-500">
                {markingMailRead ? 'Updating...' : unreadMailCount > 0 ? `${unreadMailCount} unread` : 'All caught up'}
              </div>
            </div>

            {mailItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-700 bg-gray-800/30 px-4 py-10 text-center text-gray-500">
                No mail yet. Weekend loyalty rewards will show up here after you claim them.
              </p>
            ) : (
              <div className="space-y-3">
                {mailItems.map((mail) => (
                  <article
                    key={mail.id}
                    className={`rounded-2xl border p-4 ${
                      mail.is_read
                        ? 'border-gray-800 bg-gray-800/35'
                        : 'border-yellow-400/30 bg-yellow-400/10'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${
                            mail.category === 'reward'
                              ? 'bg-yellow-400/15 text-yellow-200'
                              : 'bg-white/10 text-gray-300'
                          }`}>
                            {mail.category}
                          </span>
                          {!mail.is_read && (
                            <span className="inline-flex rounded-full bg-[#ef4444] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                              New
                            </span>
                          )}
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-white">{mail.subject}</h3>
                        <p className="mt-2 text-sm leading-6 text-gray-300">{mail.body}</p>
                      </div>
                      <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
                        {formatUtcDateTime(mail.created_at)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-6 text-center">
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/auth/login')
            }}
            className="text-sm text-gray-600 transition-colors hover:text-red-400"
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  )
}

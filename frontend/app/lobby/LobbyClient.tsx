'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TableList } from '@/components/lobby/TableList'
import { CreateTableModal } from '@/components/lobby/CreateTableModal'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { getSocket } from '@/lib/socket'
import { createClient } from '@/lib/supabase/client'
import { TableInfo, Profile } from '@/types/poker'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'

interface LobbyClientProps {
  initialTables: TableInfo[]
  profile: Profile | null
  token: string
}

export function LobbyClient({ initialTables, profile, token }: LobbyClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showCreate, setShowCreate] = useState(false)
  const [joinModal, setJoinModal] = useState<TableInfo | null>(null)
  const [buyIn, setBuyIn] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const socket = getSocket(token)

  const handleCreateTable = (params: {
    name: string; maxPlayers: number; smallBlind: number
    bigBlind: number; minBuyin: number; maxBuyin: number; buyIn: number
  }) => {
    return new Promise<void>((resolve, reject) => {
      socket.emit('create_table', params, (res: { tableId?: string; error?: string }) => {
        if (res.error) {
          reject(new Error(res.error))
        } else {
          router.push(`/table/${res.tableId}`)
          resolve()
        }
      })
    })
  }

  const handleJoinTable = (table: TableInfo) => {
    setBuyIn(table.min_buyin)
    setJoinModal(table)
    setError('')
  }

  const confirmJoin = async () => {
    if (!joinModal) return
    setLoading(true)
    setError('')
    socket.emit('join_table', { tableId: joinModal.id, buyIn }, (res: { seat?: number; error?: string }) => {
      setLoading(false)
      if (res.error) {
        setError(res.error)
      } else {
        router.push(`/table/${joinModal.id}`)
      }
    })
  }

  const handleDevMode = () => {
    const buyIn = profile?.chip_balance ? Math.min(1000, profile.chip_balance) : 1000
    socket.emit('create_dev_table', { buyIn }, (res: { tableId?: string; error?: string }) => {
      if (res.error) {
        alert(res.error)
      } else {
        router.push(`/table/${res.tableId}`)
      }
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">♠</span>
            <h1 className="text-xl font-bold text-white">Poker Room</h1>
          </div>

          <div className="flex items-center gap-4">
            {profile && (
              <div className="text-right">
                <div className="text-white font-semibold">{profile.username}</div>
                <div className="text-yellow-400 text-sm font-bold">
                  {profile.chip_balance.toLocaleString()} chips
                </div>
              </div>
            )}
            <button
              onClick={() => router.push('/profile')}
              className="flex-shrink-0 transition-all hover:scale-105"
              title="My Profile"
            >
              {profile?.avatar ? (
                <AvatarDisplay avatarId={profile.avatar} size="md" />
              ) : (
                <div className="w-12 h-12 rounded-lg border-2 border-gray-600 bg-gray-800 flex items-center justify-center text-gray-400 text-xs font-medium hover:border-yellow-500 hover:text-white transition-colors">
                  Profile
                </div>
              )}
            </button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>Sign Out</Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Available Tables</h2>
            <p className="text-gray-500 text-sm">Join a table or create your own</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="md" onClick={handleDevMode}>
              🤖 Dev Mode
            </Button>
            <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
              + Create Table
            </Button>
          </div>
        </div>

        <TableList initialTables={initialTables} onJoin={handleJoinTable} />
      </main>

      {/* Create Table Modal */}
      <CreateTableModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        chipBalance={profile?.chip_balance ?? 0}
        onCreate={handleCreateTable}
      />

      {/* Join Table Modal */}
      <Modal
        open={!!joinModal}
        onClose={() => setJoinModal(null)}
        title={`Join ${joinModal?.name ?? 'Table'}`}
      >
        {joinModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-500">Blinds</div>
                <div className="text-white font-bold">{joinModal.small_blind}/{joinModal.big_blind}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-500">Buy-in Range</div>
                <div className="text-white font-bold">{joinModal.min_buyin.toLocaleString()}–{joinModal.max_buyin.toLocaleString()}</div>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-1">Your Buy-in</label>
              <input
                type="number"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white outline-none focus:border-yellow-500"
                value={buyIn}
                onChange={(e) => setBuyIn(Number(e.target.value))}
                min={joinModal.min_buyin}
                max={Math.min(joinModal.max_buyin, profile?.chip_balance ?? 0)}
              />
              <p className="text-gray-600 text-xs mt-1">Your balance: {(profile?.chip_balance ?? 0).toLocaleString()}</p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setJoinModal(null)}>Cancel</Button>
              <Button variant="primary" className="flex-1" loading={loading} onClick={confirmJoin}>
                Take a Seat
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

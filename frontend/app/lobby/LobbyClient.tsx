'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TableList } from '@/components/lobby/TableList'
import { CreateTableModal } from '@/components/lobby/CreateTableModal'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { getSocket } from '@/lib/socket'
import { createClient } from '@/lib/supabase/client'
import { TableInfo, Profile } from '@/types/poker'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { AudioControls } from '@/components/ui/AudioControls'
import { getTableTheme } from '@/lib/table-theme'

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
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [socketError, setSocketError] = useState('')

  const socket = getSocket(token)
  const joinTheme = getTableTheme(joinModal?.big_blind ?? 10)

  useEffect(() => {
    if (socket.connected) setSocketStatus('connected')
    socket.on('connect', () => { setSocketStatus('connected'); setSocketError('') })
    socket.on('connect_error', (err) => { setSocketStatus('error'); setSocketError(err.message) })
    socket.on('disconnect', () => setSocketStatus('connecting'))
    return () => {
      socket.off('connect')
      socket.off('connect_error')
      socket.off('disconnect')
    }
  }, [socket])

  const handleCreateTable = (params: {
    name: string; maxPlayers: number; smallBlind: number
    bigBlind: number; minBuyin: number; maxBuyin: number; buyIn: number
  }) => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server not responding. It may be waking up — wait 30s and try again.'))
      }, 60000)

      socket.emit('create_table', params, (res: { tableId?: string; error?: string }) => {
        clearTimeout(timeout)
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
            <h1 className="text-xl font-bold text-white">ASL Basement Poker</h1>
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${
                socketStatus === 'connected' ? 'bg-green-400' :
                socketStatus === 'error' ? 'bg-red-400' :
                'bg-yellow-400 animate-pulse'
              }`} />
              <span className="text-gray-500">
                {socketStatus === 'connected' ? 'Server online' :
                 socketStatus === 'error' ? `Error: ${socketError || 'Server offline'}` :
                 'Connecting...'}
              </span>
            </div>
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
            <AudioControls />
            {process.env.NEXT_PUBLIC_DISCORD_URL && (
              <a
                href={process.env.NEXT_PUBLIC_DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
                title="Join our Discord"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                Discord
              </a>
            )}
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
          <div className={`space-y-4 rounded-xl border p-1 ${joinTheme.lobbyCardClass}`}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className={`${joinTheme.lobbyPanelClass} rounded-lg p-3`}>
                <div className="text-gray-500">Blinds</div>
                <div className={`font-bold ${joinTheme.lobbyAccentClass}`}>{joinModal.small_blind}/{joinModal.big_blind}</div>
              </div>
              <div className={`${joinTheme.lobbyPanelClass} rounded-lg p-3`}>
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

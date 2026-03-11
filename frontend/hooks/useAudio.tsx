'use client'

import { usePathname } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

const MUSIC_VOL_KEY = 'poker_music_vol'
const SFX_VOL_KEY = 'poker_sfx_vol'
const MUSIC_MUTE_KEY = 'poker_music_mute'
const SFX_MUTE_KEY = 'poker_sfx_mute'

const DEFAULT_PLAYLIST = [
  '/sounds/bgm/jazz1.mp3',
  '/sounds/bgm/jazz2.mp3',
  '/sounds/bgm/jazz3.mp3',
  '/sounds/bgm/mix1.mp3',
  '/sounds/bgm/mix2.mp3',
  '/sounds/bgm/mix3.mp3',
  '/sounds/bgm/rock.mp3',
  '/sounds/bgm/rock2.mp3',
  '/sounds/bgm/bossa-nova.mp3',
]

const REGISTER_PLAYLIST = ['/sounds/bgm/welcome.mp3']

const SFX_MAP = {
  call: '/sounds/sfx/call.mp3',
  allin: '/sounds/sfx/all-in.mp3',
  click: '/sounds/sfx/click.mp3',
  shuffle: '/sounds/sfx/shuffle.mp3',
  check: '/sounds/sfx/check.mp3',
  deal: '/sounds/sfx/deal.mp3',
  fold: '/sounds/sfx/fold.mp3',
  joinLeave: '/sounds/sfx/join-leave.mp3',
  lose: '/sounds/sfx/lose.mp3',
  raise: '/sounds/sfx/raise.mp3',
  sitStand: '/sounds/sfx/sit-stand.mp3',
  win: '/sounds/sfx/win.mp3',
} as const

type SfxName = keyof typeof SFX_MAP

interface AudioContextValue {
  musicVol: number
  sfxVol: number
  musicMute: boolean
  sfxMute: boolean
  currentTrackLabel: string
  setMusicVol: (value: number) => void
  setSfxVol: (value: number) => void
  toggleMusic: () => void
  toggleSfx: () => void
  nextTrack: () => void
  playSfx: (name: SfxName) => void
}

const AudioContext = createContext<AudioContextValue | null>(null)

function loadPref(key: string, fallback: number | boolean): number | boolean {
  if (typeof window === 'undefined') return fallback
  const value = localStorage.getItem(key)
  if (value === null) return fallback
  if (typeof fallback === 'boolean') return value === 'true'

  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function playOnce(src: string, volume: number) {
  try {
    const audio = new Audio(src)
    audio.volume = Math.max(0, Math.min(1, volume))
    audio.play().catch(() => {})
  } catch {}
}

function getPlaylist(pathname: string | null) {
  if (pathname?.startsWith('/auth/register')) {
    return REGISTER_PLAYLIST
  }

  return DEFAULT_PLAYLIST
}

function getTrackLabel(src: string) {
  const fileName = src.split('/').pop()?.replace('.mp3', '') ?? 'track'
  return fileName.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [musicVol, setMusicVolState] = useState<number>(() => loadPref(MUSIC_VOL_KEY, 0.4) as number)
  const [sfxVol, setSfxVolState] = useState<number>(() => loadPref(SFX_VOL_KEY, 0.6) as number)
  const [musicMute, setMusicMuteState] = useState<boolean>(() => loadPref(MUSIC_MUTE_KEY, false) as boolean)
  const [sfxMute, setSfxMuteState] = useState<boolean>(() => loadPref(SFX_MUTE_KEY, false) as boolean)
  const [currentTrackLabel, setCurrentTrackLabel] = useState('Jazz 1')

  const bgAudio = useRef<HTMLAudioElement | null>(null)
  const playlistRef = useRef<string[]>([])
  const trackIndexRef = useRef(0)

  const syncPlayback = useCallback(() => {
    if (!bgAudio.current) return
    bgAudio.current.volume = musicMute ? 0 : musicVol

    if (musicMute) {
      bgAudio.current.pause()
      return
    }

    bgAudio.current.play().catch(() => {})
  }, [musicMute, musicVol])

  const loadTrack = useCallback(
    (playlist: string[], index: number) => {
      if (!bgAudio.current || playlist.length === 0) return

      trackIndexRef.current = index % playlist.length
      bgAudio.current.loop = playlist.length === 1
      bgAudio.current.src = playlist[trackIndexRef.current]
      bgAudio.current.load()
      setCurrentTrackLabel(getTrackLabel(playlist[trackIndexRef.current]))
      syncPlayback()
    },
    [syncPlayback]
  )

  const advanceTrack = useCallback(() => {
    const playlist = playlistRef.current
    if (playlist.length <= 1) return
    loadTrack(playlist, trackIndexRef.current + 1)
  }, [loadTrack])

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'

    const onEnded = () => advanceTrack()
    audio.addEventListener('ended', onEnded)

    bgAudio.current = audio
    playlistRef.current = getPlaylist(pathname)
    loadTrack(playlistRef.current, 0)

    return () => {
      audio.pause()
      audio.removeEventListener('ended', onEnded)
      bgAudio.current = null
    }
  }, [advanceTrack, loadTrack, pathname])

  useEffect(() => {
    const nextPlaylist = getPlaylist(pathname)
    const currentPlaylist = playlistRef.current
    const changed =
      nextPlaylist.length !== currentPlaylist.length ||
      nextPlaylist.some((track, index) => track !== currentPlaylist[index])

    if (!changed) return

    playlistRef.current = nextPlaylist
    loadTrack(nextPlaylist, 0)
  }, [loadTrack, pathname])

  useEffect(() => {
    syncPlayback()
  }, [syncPlayback])

  useEffect(() => {
    if (musicMute) return

    const unlock = () => {
      syncPlayback()
    }

    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock)

    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [musicMute, syncPlayback])

  const setMusicVol = useCallback((value: number) => {
    setMusicVolState(value)
    localStorage.setItem(MUSIC_VOL_KEY, String(value))
  }, [])

  const setSfxVol = useCallback((value: number) => {
    setSfxVolState(value)
    localStorage.setItem(SFX_VOL_KEY, String(value))
  }, [])

  const toggleMusic = useCallback(() => {
    setMusicMuteState((previous) => {
      const next = !previous
      localStorage.setItem(MUSIC_MUTE_KEY, String(next))
      return next
    })
  }, [])

  const toggleSfx = useCallback(() => {
    setSfxMuteState((previous) => {
      const next = !previous
      localStorage.setItem(SFX_MUTE_KEY, String(next))
      return next
    })
  }, [])

  const playSfx = useCallback(
    (name: SfxName) => {
      if (sfxMute) return
      playOnce(SFX_MAP[name], sfxVol)
    },
    [sfxMute, sfxVol]
  )

  const value = useMemo<AudioContextValue>(
    () => ({
      musicVol,
      sfxVol,
      musicMute,
      sfxMute,
      currentTrackLabel,
      setMusicVol,
      setSfxVol,
      toggleMusic,
      toggleSfx,
      nextTrack: advanceTrack,
      playSfx,
    }),
    [advanceTrack, currentTrackLabel, musicMute, musicVol, playSfx, setMusicVol, setSfxVol, sfxMute, sfxVol, toggleMusic, toggleSfx]
  )

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
}

export function useAudio() {
  const context = useContext(AudioContext)

  if (!context) {
    throw new Error('useAudio must be used within AudioProvider')
  }

  return context
}


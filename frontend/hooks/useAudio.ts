'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const MUSIC_VOL_KEY   = 'poker_music_vol'
const SFX_VOL_KEY     = 'poker_sfx_vol'
const MUSIC_MUTE_KEY  = 'poker_music_mute'
const SFX_MUTE_KEY    = 'poker_sfx_mute'

function loadPref(key: string, fallback: number | boolean): number | boolean {
  if (typeof window === 'undefined') return fallback
  const v = localStorage.getItem(key)
  if (v === null) return fallback
  if (typeof fallback === 'boolean') return v === 'true'
  return parseFloat(v)
}

function playOnce(src: string, vol: number) {
  try {
    const a = new Audio(src)
    a.volume = Math.max(0, Math.min(1, vol))
    a.play().catch(() => {/* file missing or blocked — silent */})
  } catch {/* ignore */}
}

export function useAudio() {
  const [musicVol,  setMusicVolState]  = useState<number>(() => loadPref(MUSIC_VOL_KEY,  0.4) as number)
  const [sfxVol,    setSfxVolState]    = useState<number>(() => loadPref(SFX_VOL_KEY,    0.6) as number)
  const [musicMute, setMusicMuteState] = useState<boolean>(() => loadPref(MUSIC_MUTE_KEY, false) as boolean)
  const [sfxMute,   setSfxMuteState]   = useState<boolean>(() => loadPref(SFX_MUTE_KEY,   false) as boolean)

  const bgAudio = useRef<HTMLAudioElement | null>(null)

  // Initialise background music element once (client-side)
  useEffect(() => {
    const audio = new Audio('/sounds/background.mp3')
    audio.loop   = true
    audio.volume = musicMute ? 0 : musicVol
    bgAudio.current = audio

    if (!musicMute) {
      audio.play().catch(() => {/* autoplay blocked — user must interact first */})
    }

    return () => {
      audio.pause()
      bgAudio.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync music volume / mute to the audio element
  useEffect(() => {
    if (!bgAudio.current) return
    bgAudio.current.volume = musicMute ? 0 : musicVol
    if (!musicMute && bgAudio.current.paused) {
      bgAudio.current.play().catch(() => {})
    } else if (musicMute && !bgAudio.current.paused) {
      bgAudio.current.pause()
    }
  }, [musicVol, musicMute])

  const setMusicVol = useCallback((v: number) => {
    setMusicVolState(v)
    localStorage.setItem(MUSIC_VOL_KEY, String(v))
  }, [])

  const setSfxVol = useCallback((v: number) => {
    setSfxVolState(v)
    localStorage.setItem(SFX_VOL_KEY, String(v))
  }, [])

  const toggleMusic = useCallback(() => {
    setMusicMuteState(prev => {
      const next = !prev
      localStorage.setItem(MUSIC_MUTE_KEY, String(next))
      return next
    })
  }, [])

  const toggleSfx = useCallback(() => {
    setSfxMuteState(prev => {
      const next = !prev
      localStorage.setItem(SFX_MUTE_KEY, String(next))
      return next
    })
  }, [])

  const playSfx = useCallback((name: 'deal' | 'chips' | 'win' | 'fold' | 'check') => {
    if (sfxMute) return
    playOnce('/sounds/' + name + '.mp3', sfxVol)
  }, [sfxMute, sfxVol])

  return { musicVol, sfxVol, musicMute, sfxMute, setMusicVol, setSfxVol, toggleMusic, toggleSfx, playSfx }
}

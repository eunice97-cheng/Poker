'use client'

import { useState, useRef, useEffect } from 'react'
import { useAudio } from '@/hooks/useAudio'

export function AudioControls() {
  const {
    musicVol,
    sfxVol,
    musicMute,
    sfxMute,
    currentTrackLabel,
    setMusicVol,
    setSfxVol,
    toggleMusic,
    toggleSfx,
    nextTrack,
  } = useAudio()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const allMuted = musicMute && sfxMute

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/78 transition-colors hover:border-[#f3d2a2]/24 hover:text-white"
        title="Audio settings"
        aria-label="Audio settings"
      >
        {allMuted ? 'Muted' : 'Audio'}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-gray-700 bg-gray-800 p-3 shadow-2xl">
          <div className="mb-3 rounded-lg border border-white/8 bg-black/20 p-2.5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Now playing</div>
            <div className="mt-1 text-sm font-semibold text-white">{currentTrackLabel}</div>
            <button
              onClick={nextTrack}
              className="mt-2 w-full rounded-lg border border-yellow-400/25 bg-yellow-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-yellow-200 transition-colors hover:bg-yellow-500/20"
            >
              Skip to next
            </button>
          </div>

          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Music</span>
              <button
                onClick={toggleMusic}
                className="rounded-md border border-white/8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75 transition-opacity hover:opacity-70"
                title={musicMute ? 'Unmute music' : 'Mute music'}
              >
                {musicMute ? 'Off' : 'On'}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={musicVol}
              onChange={(e) => setMusicVol(parseFloat(e.target.value))}
              disabled={musicMute}
              className="h-1 w-full cursor-pointer accent-yellow-400 disabled:opacity-30"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Sound FX</span>
              <button
                onClick={toggleSfx}
                className="rounded-md border border-white/8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75 transition-opacity hover:opacity-70"
                title={sfxMute ? 'Unmute SFX' : 'Mute SFX'}
              >
                {sfxMute ? 'Off' : 'On'}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={sfxVol}
              onChange={(e) => setSfxVol(parseFloat(e.target.value))}
              disabled={sfxMute}
              className="h-1 w-full cursor-pointer accent-yellow-400 disabled:opacity-30"
            />
          </div>
        </div>
      )}
    </div>
  )
}

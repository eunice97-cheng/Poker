'use client'

import { useState, useRef, useEffect } from 'react'
import { useAudio } from '@/hooks/useAudio'

export function AudioControls() {
  const { musicVol, sfxVol, musicMute, sfxMute, setMusicVol, setSfxVol, toggleMusic, toggleSfx } = useAudio()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close panel when clicking outside
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
        className="text-xl leading-none transition-opacity hover:opacity-80 select-none"
        title="Audio settings"
        aria-label="Audio settings"
      >
        {allMuted ? '🔇' : '🔊'}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-gray-800 border border-gray-700 rounded-xl p-3 shadow-2xl z-50">

          {/* Music row */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-gray-400 text-xs font-medium">Music</span>
              <button
                onClick={toggleMusic}
                className="text-sm leading-none hover:opacity-70 transition-opacity"
                title={musicMute ? 'Unmute music' : 'Mute music'}
              >
                {musicMute ? '🔇' : '🎵'}
              </button>
            </div>
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={musicVol}
              onChange={(e) => setMusicVol(parseFloat(e.target.value))}
              disabled={musicMute}
              className="w-full h-1 accent-yellow-400 cursor-pointer disabled:opacity-30"
            />
          </div>

          {/* SFX row */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-gray-400 text-xs font-medium">Sound FX</span>
              <button
                onClick={toggleSfx}
                className="text-sm leading-none hover:opacity-70 transition-opacity"
                title={sfxMute ? 'Unmute SFX' : 'Mute SFX'}
              >
                {sfxMute ? '🔇' : '🔊'}
              </button>
            </div>
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={sfxVol}
              onChange={(e) => setSfxVol(parseFloat(e.target.value))}
              disabled={sfxMute}
              className="w-full h-1 accent-yellow-400 cursor-pointer disabled:opacity-30"
            />
          </div>

        </div>
      )}
    </div>
  )
}

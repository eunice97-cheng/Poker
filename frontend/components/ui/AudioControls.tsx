'use client'

import { useAudio } from '@/hooks/useAudio'

export function AudioControls() {
  const { musicVol, sfxVol, musicMute, sfxMute, setMusicVol, setSfxVol, toggleMusic, toggleSfx } = useAudio()

  return (
    <div className="flex items-center gap-3">
      {/* Music toggle + slider */}
      <div className="flex items-center gap-1.5" title="Background Music">
        <button
          onClick={toggleMusic}
          className="text-lg leading-none transition-opacity"
          style={{ opacity: musicMute ? 0.35 : 1 }}
          aria-label={musicMute ? 'Unmute music' : 'Mute music'}
        >
          🎵
        </button>
        {!musicMute && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={musicVol}
            onChange={(e) => setMusicVol(parseFloat(e.target.value))}
            className="w-16 h-1 accent-yellow-400 cursor-pointer"
            aria-label="Music volume"
          />
        )}
      </div>

      {/* SFX toggle + slider */}
      <div className="flex items-center gap-1.5" title="Sound Effects">
        <button
          onClick={toggleSfx}
          className="text-lg leading-none transition-opacity"
          style={{ opacity: sfxMute ? 0.35 : 1 }}
          aria-label={sfxMute ? 'Unmute SFX' : 'Mute SFX'}
        >
          🔊
        </button>
        {!sfxMute && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sfxVol}
            onChange={(e) => setSfxVol(parseFloat(e.target.value))}
            className="w-16 h-1 accent-yellow-400 cursor-pointer"
            aria-label="SFX volume"
          />
        )}
      </div>
    </div>
  )
}

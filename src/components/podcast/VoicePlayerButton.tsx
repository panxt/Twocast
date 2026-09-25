'use client'

import { useEffect, useRef } from 'react'

export function VoicePlayerButton({ id, sample, label, playingVoiceId, setPlayingVoiceId, audioRefs }: {
  id: string
  sample: string
  label: string
  playingVoiceId: string | null
  setPlayingVoiceId: (id: string | null) => void
  audioRefs: React.MutableRefObject<{ [key: string]: HTMLAudioElement | null }>
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isPlaying = playingVoiceId === id

  useEffect(() => {
    const audio = audioRef.current
    const refs = audioRefs.current
    return () => {
      if (audio && !audio.paused) {
        audio.pause()
        setPlayingVoiceId(null)
      }
      if (refs[id] === audio) refs[id] = null
    }
  }, [audioRefs, id, setPlayingVoiceId])

  function togglePreview(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      audio.currentTime = 0
      setPlayingVoiceId(null)
      return
    }
    Object.entries(audioRefs.current).forEach(([key, other]) => {
      if (key !== id && other) {
        other.pause()
        other.currentTime = 0
      }
    })
    audio.play().then(() => {
      if (audioRef.current === audio) setPlayingVoiceId(id)
      else audio.pause()
    }).catch(() => { if (audioRef.current === audio) setPlayingVoiceId(null) })
  }

  return <div className="flex items-center gap-2">
    {sample ? <>
      <button type="button" onClick={togglePreview} aria-label={`${isPlaying ? '暂停' : '试听'}${label}`}
        className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
        {isPlaying ? 'Ⅱ' : '▶'}
      </button>
      <audio ref={element => { audioRef.current = element; audioRefs.current[id] = element }} src={sample}
        preload="none" onEnded={() => setPlayingVoiceId(null)} />
    </> : <span className="h-8 w-8 flex-shrink-0" aria-hidden="true" />}
    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
  </div>
}

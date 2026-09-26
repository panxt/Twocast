'use client'

import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { formatTime } from '@/utils/time'
import { RouteProgress } from './RouteProgress'

type Variant = 'ready' | 'playing' | 'running' | 'failed'

// 卡片封面：有图用图；没图就用"大号时长 + 声波"当封面，生成中画驿路进度，失败直接写原因。
export function CoverArt({ variant, coverUrl, title, duration, progressLabel, progressPercent, error, className = '' }: {
  variant: Variant
  coverUrl?: string | null
  title: string
  duration?: number | null
  progressLabel?: string
  progressPercent?: number | null
  error?: string | null
  className?: string
}) {
  const base = `relative flex h-28 flex-col justify-between overflow-hidden p-4 ${className}`
  if (variant === 'running') {
    return <div className={`${base} bg-voice-tint text-voice-deep`}>
      <span className="flex items-center gap-1.5 text-xs font-semibold"><LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{progressLabel}{progressPercent !== null && progressPercent !== undefined ? ` · ${Math.round(progressPercent)}%` : ''}</span>
      <RouteProgress percent={progressPercent ?? null} label={progressLabel || '正在生成'} />
    </div>
  }
  if (variant === 'failed') {
    return <div className={`${base} bg-alert-tint text-alert-deep`}>
      <span className="flex items-center gap-1.5 text-xs font-semibold"><TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />生成失败</span>
      <span className="line-clamp-2 text-[13px] leading-snug">{error || '请重试，或换一种资料来源。'}</span>
    </div>
  }
  if (coverUrl) {
    return <div className={`${base} bg-paper`}>
      <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {variant === 'playing' && <span className="relative ml-auto mt-auto rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-semibold text-sheet backdrop-blur">正在播放</span>}
    </div>
  }
  const playing = variant === 'playing'
  return <div className={`${base} ${playing ? 'bg-ink text-sheet' : 'bg-brand-tint text-ink'}`} aria-label={`${title}，${duration ? formatTime(duration) : ''}`}>
    <span className="sr-only">{title}</span>
    <div className="mt-auto flex items-end justify-between gap-3">
      <span className="ys-title text-3xl leading-none tabular-nums">{duration ? formatTime(duration) : '—'}</span>
      <svg width="110" height="36" viewBox="0 0 120 36" aria-hidden="true" className="shrink-0">
        <path d="M4 30c14 0 14-24 28-24s14 24 28 24 14-24 28-24 14 24 28 24" fill="none" strokeWidth="3" strokeLinecap="round"
          stroke={playing ? 'var(--ys-voice)' : 'var(--ys-brand)'} opacity={playing ? 1 : 0.5} />
      </svg>
    </div>
  </div>
}

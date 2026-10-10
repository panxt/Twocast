'use client'

import { useState } from 'react'
import {
  Download,
  ExternalLink,
  FileText,
  Folder,
  LoaderCircle,
  Lock,
  Pause,
  Play,
  Users,
} from 'lucide-react'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { useTranslation } from '@/i18n/client'
import { useParams } from 'next/navigation'
import type { LocaleTypes } from '@/i18n/settings'
import { formatTime } from '@/utils/time'
import { CoverActionButtons } from '@/components/podcast/CoverActions'

interface PodcastPlayerProps {
  trackId: string
  audioUrl: string
  downloadUrl?: string
  title: string
  artist?: string
  thumbnail?: string
  duration?: number
  lyricsUrl?: string
  bundleUrl?: string
  ownerName?: string
  folderPath?: string
  visibility?: 'private' | 'team' | 'public'
  createdAt?: string
  fileUrl?: string
  fileName?: string
  sourceTextUrl?: string
  sourceInfo?: { characters: number; language: string | null; coverage: string | null }
  sourceUrl?: string
  coverUrl?: string | null
  canManageCover?: boolean
}

const folderLabel = (path?: string) => {
  const parts = (path || '/').split('/').filter(Boolean)
  return parts.length ? parts.join(' / ') : '未归档'
}

export default function PodcastPlayer({
  trackId,
  audioUrl,
  downloadUrl,
  title,
  artist,
  duration,
  lyricsUrl,
  bundleUrl,
  ownerName,
  folderPath,
  visibility,
  createdAt,
  fileUrl,
  fileName,
  sourceUrl,
  sourceTextUrl,
  sourceInfo,
  coverUrl: initialCover,
  canManageCover,
}: PodcastPlayerProps) {
  const {
    play,
    pause,
    resume,
    seek,
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration: liveDuration,
  } = useAudioPlayer()
  const locale = (useParams()?.locale || 'zh') as LocaleTypes
  const { t } = useTranslation(locale, 'podcast')
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCover || null)

  // 检查是否是当前正在播放的音频
  const isCurrentTrack = currentTrack?.id === trackId
  const total = isCurrentTrack && liveDuration > 0 ? liveDuration : duration || 0
  const position = isCurrentTrack ? currentTime : 0
  const active = isCurrentTrack && (isPlaying || isLoading)

  // 开始播放
  const handlePlay = () => {
    if (!audioUrl) return // 如果没有音频URL，则不执行任何操作
    if (isCurrentTrack) {
      if (isPlaying || isLoading) pause()
      else resume()
      return
    }
    play({ id: trackId, url: audioUrl, title, artist, thumbnail: coverUrl || undefined, duration })
  }

  return (
    <section
      aria-label="节目"
      className="ys-sheet flex flex-col gap-5 p-5 sm:flex-row sm:gap-7 sm:p-7"
    >
      {/* 封面 */}
      <div className="flex shrink-0 flex-col gap-3 sm:w-44">
        <div
          className={`relative aspect-square w-full overflow-hidden rounded-control ${coverUrl ? 'bg-paper' : active ? 'bg-ink text-sheet' : 'bg-brand-tint text-ink'}`}
        >
          {coverUrl ? (
            <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <span className="ys-title text-3xl tabular-nums leading-none">
                {total ? formatTime(total) : '—'}
              </span>
              <svg viewBox="0 0 120 36" aria-hidden="true" className="mt-2 w-full">
                <path
                  d="M4 30c14 0 14-24 28-24s14 24 28 24 14-24 28-24 14 24 28 24"
                  fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                  stroke={active ? 'var(--ys-voice)' : 'var(--ys-brand)'}
                  opacity={active ? 1 : 0.5}
                />
              </svg>
            </div>
          )}
        </div>
        {canManageCover && (
          <CoverActionButtons
            uuid={trackId}
            hasCover={Boolean(coverUrl)}
            canGenerate
            onChanged={setCoverUrl}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <h1 className="ys-title text-2xl leading-snug sm:text-[30px]">{title}</h1>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-ink-soft">
          {total > 0 && (
            <span className="font-semibold tabular-nums text-ink">{formatTime(total)}</span>
          )}
          {folderPath && folderPath !== '/' && (
            <span className="inline-flex items-center gap-1">
              <Folder className="h-3.5 w-3.5" aria-hidden="true" />
              {folderLabel(folderPath)}
            </span>
          )}
          {visibility === 'public' ? (
            <span className="ys-pill bg-brand-tint text-brand">公共空间</span>
          ) : visibility === 'team' ? (
            <span className="inline-flex items-center gap-1 text-voice">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              团队共享
            </span>
          ) : visibility === 'private' ? (
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              仅自己可见
            </span>
          ) : null}
          {(ownerName || createdAt) && (
            <span className="tabular-nums">
              {[
                ownerName,
                createdAt
                  ? new Date(createdAt).toLocaleDateString('zh-CN', {
                      timeZone: 'Asia/Shanghai',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '',
              ]
                .filter(Boolean)
                .join(' / ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePlay}
            disabled={!audioUrl}
            aria-label={active ? '暂停' : '播放'}
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-full transition-colors ${active ? 'bg-voice text-brand-on' : 'bg-brand text-brand-on hover:bg-brand-hover'} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isLoading && isCurrentTrack ? (
              <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />
            ) : isPlaying && isCurrentTrack ? (
              <Pause className="h-6 w-6" fill="currentColor" aria-hidden="true" />
            ) : (
              <Play className="ml-0.5 h-6 w-6" fill="currentColor" aria-hidden="true" />
            )}
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3 text-xs tabular-nums text-ink-soft">
            <span>{formatTime(position)}</span>
            <input
              type="range"
              min={0}
              max={total || 0}
              step={1}
              value={position}
              disabled={!isCurrentTrack || !total}
              onChange={(event) => seek(parseFloat(event.target.value))}
              aria-label="播放进度"
              className="ys-range flex-1 disabled:cursor-default"
            />
            <span>{formatTime(total)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {bundleUrl && (
            <a
              href={bundleUrl}
              className="ys-btn ys-btn-primary min-h-10 px-3.5"
              title="包含播客目标语言字幕和已保存的源语言文字稿；源字幕使用原视频时间轴"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              下载 MP3 + 源/目标字幕
            </a>
          )}
          <a
            href={downloadUrl || audioUrl}
            download={`${title}.mp3`}
            className={`ys-btn min-h-10 px-3.5 ${bundleUrl ? 'ys-btn-secondary' : 'ys-btn-primary'}`}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {bundleUrl ? '仅 MP3' : t('download')}
          </a>
          {lyricsUrl && (
            <a
              href={lyricsUrl}
              download
              title="同步字幕（.lrc）"
              className="ys-btn ys-btn-secondary min-h-10 px-3.5"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              仅播客字幕 LRC
            </a>
          )}
          {fileUrl && (
            <a href={fileUrl} className="ys-btn ys-btn-secondary min-h-10 max-w-full px-3.5">
              <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">原文件{fileName ? `：${fileName}` : ''}</span>
            </a>
          )}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={sourceUrl}
              className="ys-btn ys-btn-secondary min-h-10 max-w-full px-3.5"
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">原地址 · {new URL(sourceUrl).hostname}</span>
            </a>
          )}
          {sourceTextUrl && (
            <>
              <a
                href={sourceTextUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ys-btn ys-btn-secondary min-h-10 px-3.5"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                查看提取文字稿
              </a>
              <a
                href={`${sourceTextUrl}?download=1`}
                className="ys-btn ys-btn-secondary min-h-10 px-3.5"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                下载原文字稿 TXT
              </a>
            </>
          )}
        </div>
        {sourceInfo && (
          <p className="text-xs leading-5 text-ink-soft">
            本期生成使用的来源文字稿：{sourceInfo.characters.toLocaleString()} 字符
            {sourceInfo.language ? ` · 字幕语言 ${sourceInfo.language}` : ''}。
            {sourceInfo.coverage
              ? `字幕时间覆盖至 ${sourceInfo.coverage}，请与原视频结束位置核对；覆盖到结尾不代表每句都无遗漏。`
              : '这期未保存来源时间戳，无法按时间验证覆盖程度。'}
            播客是整理改写，时长不等同原视频；提取文字稿与下方生成脚本是不同内容。
          </p>
        )}
        {lyricsUrl && (
          <p className="text-xs text-ink-soft">
            打包下载保留源语言全文与播客目标语言字幕。根目录同名 LRC / SRT 对应播客；
            「源语言-原视频」使用原视频时间轴，没有时间戳时提供 TXT，不会截短原文。
            两份文本经过改写，不能逐句对齐。支持本地歌词的播放器可加载同名 LRC；MP3 内也已写入 ID3
            歌词。也可以
            <a href="#synchronized-script" className="font-medium text-brand underline">
              在本页边听边看同步脚本
            </a>
            。
          </p>
        )}
      </div>
    </section>
  )
}

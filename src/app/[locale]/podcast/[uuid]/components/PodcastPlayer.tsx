'use client';

import { Download, FileText, Folder, LoaderCircle, Lock, Pause, Play, Users } from 'lucide-react';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useTranslation } from 'react-i18next';
import { formatTime } from '@/utils/time';

interface PodcastPlayerProps {
  trackId: string;
  audioUrl: string;
  downloadUrl?: string;
  title: string;
  artist?: string;
  thumbnail?: string;
  duration?: number;
  lyricsUrl?: string;
  bundleUrl?: string;
  ownerName?: string;
  folderPath?: string;
  visibility?: 'private' | 'team';
  createdAt?: string;
  fileUrl?: string;
  fileName?: string;
}

const folderLabel = (path?: string) => {
  const parts = (path || '/').split('/').filter(Boolean)
  return parts.length ? parts.join(' / ') : '未归档'
}

export default function PodcastPlayer({ trackId, audioUrl, downloadUrl, title, artist, thumbnail, duration, lyricsUrl, bundleUrl,
  ownerName, folderPath, visibility, createdAt, fileUrl, fileName }: PodcastPlayerProps) {
  const { play, pause, resume, seek, currentTrack, isPlaying, isLoading, currentTime, duration: liveDuration } = useAudioPlayer();
  const { t } = useTranslation('podcast');

  // 检查是否是当前正在播放的音频
  const isCurrentTrack = currentTrack?.id === trackId;
  const total = isCurrentTrack && liveDuration > 0 ? liveDuration : duration || 0;
  const position = isCurrentTrack ? currentTime : 0;
  const percent = total > 0 ? Math.min(100, position / total * 100) : 0;

  // 开始播放
  const handlePlay = () => {
    if (!audioUrl) return; // 如果没有音频URL，则不执行任何操作

    if (isCurrentTrack) {
      if (isPlaying || isLoading) pause();
      else resume();
      return;
    }

    play({
      id: trackId,
      url: audioUrl,
      title,
      artist,
      thumbnail,
      duration,
    });
  };

  return (
    <section aria-label="节目" className="ys-sheet grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 p-5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-6 sm:p-8">
      <button
        type="button"
        onClick={handlePlay}
        disabled={!audioUrl}
        aria-label={isCurrentTrack && (isPlaying || isLoading) ? '暂停' : '播放'}
        className={`grid h-14 w-14 place-items-center rounded-full transition-colors sm:h-[4.5rem] sm:w-[4.5rem] ${isCurrentTrack && (isPlaying || isLoading) ? 'bg-voice text-brand-on' : 'bg-brand text-brand-on hover:bg-brand-hover'} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {isLoading && isCurrentTrack
          ? <LoaderCircle className="h-6 w-6 animate-spin sm:h-7 sm:w-7" aria-hidden="true" />
          : isPlaying && isCurrentTrack
            ? <Pause className="h-6 w-6 sm:h-7 sm:w-7" fill="currentColor" aria-hidden="true" />
            : <Play className="ml-0.5 h-6 w-6 sm:ml-1 sm:h-7 sm:w-7" fill="currentColor" aria-hidden="true" />}
      </button>

      <div className="flex min-w-0 flex-col gap-3">
        {thumbnail && <img src={thumbnail} alt="" className="h-24 w-24 rounded-control object-cover" />}
        <h1 className="ys-title text-2xl leading-snug sm:text-[30px]">{title}</h1>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-ink-soft">
          {total > 0 && <span className="font-semibold tabular-nums text-ink">{formatTime(total)}</span>}
          {folderPath !== undefined && <span className="inline-flex items-center gap-1"><Folder className="h-3.5 w-3.5" aria-hidden="true" />{folderLabel(folderPath)}</span>}
          {visibility === 'team'
            ? <span className="inline-flex items-center gap-1 text-voice"><Users className="h-3.5 w-3.5" aria-hidden="true" />团队共享</span>
            : visibility === 'private' ? <span className="inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5" aria-hidden="true" />仅自己可见</span> : null}
          {(ownerName || createdAt) && <span className="tabular-nums">{[ownerName, createdAt ? new Date(createdAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric' }) : ''].filter(Boolean).join(' / ')}</span>}
        </div>

        <div className="col-span-2 flex items-center gap-3 text-xs tabular-nums text-ink-soft sm:col-span-1">
          <span>{formatTime(position)}</span>
          <input type="range" min={0} max={total || 0} step={1} value={position} disabled={!isCurrentTrack || !total}
            onChange={event => seek(parseFloat(event.target.value))} aria-label="播放进度" className="ys-range flex-1 disabled:cursor-default" />
          <span>{formatTime(total)}</span>
        </div>

        <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1">
          {bundleUrl && <a href={bundleUrl} className="ys-btn ys-btn-primary min-h-10 px-3.5" title="解压后 MP3 与同名 .lrc 放在同一目录，网易云等本地播放器即可显示字幕">
            <Download className="h-4 w-4" aria-hidden="true" />下载 MP3 + 字幕
          </a>}
          <a href={downloadUrl || audioUrl} download={`${title}.mp3`} className={`ys-btn min-h-10 px-3.5 ${bundleUrl ? 'ys-btn-secondary' : 'ys-btn-primary'}`}>
            <Download className="h-4 w-4" aria-hidden="true" />{bundleUrl ? '仅 MP3' : t('download')}
          </a>
          {lyricsUrl && <a href={lyricsUrl} download title="同步字幕（.lrc）" className="ys-btn ys-btn-secondary min-h-10 px-3.5">
            <FileText className="h-4 w-4" aria-hidden="true" />仅字幕 LRC
          </a>}
          {fileUrl && <a href={fileUrl} className="ys-btn ys-btn-secondary min-h-10 max-w-full px-3.5">
            <FileText className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">原文件{fileName ? `：${fileName}` : ''}</span>
          </a>}
        </div>
        {lyricsUrl && <p className="col-span-2 text-xs text-ink-soft sm:col-span-1">
          网易云等桌面播放器对本地歌曲只认「同目录、同文件名」的 .lrc：下载打包版解压后直接导入即可；MP3 内也已写入 ID3 歌词。也可以<a href="#synchronized-script" className="font-medium text-brand underline">在本页边听边看同步脚本</a>。
        </p>}
      </div>
    </section>
  );
}

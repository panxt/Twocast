'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, LoaderCircle, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX, X } from 'lucide-react';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { formatTime } from '@/utils/time';

// 底部播放条：页面里唯一带阴影的东西——它浮在纸面之上。
export default function GlobalAudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    isVisible,
    pause,
    resume,
    seek,
    setVolume,
    toggleMute,
    hide,
    setPlaybackRate,
    playbackRate,
  } = useAudioPlayer();

  const [isExpanded, setIsExpanded] = useState(false);

  // 播放速度选项数组
  const playbackRates = [0.7, 0.8, 0.9, 1, 1.25, 1.5, 2];

  if (!isVisible || !currentTrack) {
    return null;
  }

  const handleTogglePlay = () => {
    if (isPlaying || isLoading) pause();
    else resume();
  };
  const skip = (delta: number) => seek(Math.max(0, Math.min(duration || 0, currentTime + delta)));
  const percent = duration ? (currentTime / duration) * 100 : 0;

  const playButton = (size: 'md' | 'lg') => (
    <button
      type="button"
      onClick={handleTogglePlay}
      aria-label={isPlaying || isLoading ? '暂停' : '播放'}
      className={`grid shrink-0 place-items-center rounded-full bg-brand text-brand-on transition-colors hover:bg-brand-hover ${size === 'lg' ? 'h-14 w-14' : 'h-11 w-11'}`}
    >
      {isLoading
        ? <LoaderCircle className={`animate-spin ${size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'}`} aria-hidden="true" />
        : isPlaying
          ? <Pause className={size === 'lg' ? 'h-6 w-6' : 'h-4 w-4'} fill="currentColor" aria-hidden="true" />
          : <Play className={`ml-0.5 ${size === 'lg' ? 'h-6 w-6' : 'h-4 w-4'}`} fill="currentColor" aria-hidden="true" />}
    </button>
  );

  const rateSelect = (
    <label className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
      <span className="sr-only">播放速度</span>
      <select
        className="ys-field-sm w-auto py-1 pr-7 text-xs font-semibold tabular-nums text-ink"
        value={playbackRate}
        onChange={e => setPlaybackRate(Number(e.target.value))}
        aria-label="播放速度"
      >
        {playbackRates.map(rate => <option key={rate} value={rate}>{rate.toFixed(rate === 1 ? 1 : 2).replace(/0$/, '')}×</option>)}
      </select>
    </label>
  );

  return (
    <>
      {/* 底部固定播放器 */}
      <div role="region" aria-label="正在播放" className="fixed bottom-0 left-0 right-0 z-50 border-t border-rule bg-sheet/95 shadow-bar backdrop-blur">
        {/* 进度条：顶边一根细线 */}
        <div className="absolute left-0 top-0 h-0.5 w-full bg-rule" aria-hidden="true">
          <div className="h-full bg-voice transition-[width] duration-200" style={{ width: `${percent}%` }} />
        </div>

        {/* 紧凑模式 */}
        {!isExpanded && <div className="mx-auto grid h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:h-[4.5rem] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-6 sm:px-6 lg:px-10">
          {/* 左侧：播放信息 */}
          <div className="flex min-w-0 items-center gap-3">
            {currentTrack.thumbnail
              ? <img src={currentTrack.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded-control object-cover" />
              : <span aria-hidden="true" className="hidden h-10 w-10 shrink-0 place-items-center rounded-control bg-voice-tint text-voice sm:grid">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h2l2-6 3 12 3-9 2 6 2-3h4" /></svg>
                </span>}
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-ink">{currentTrack.title}</p>
              <p className="text-xs tabular-nums text-ink-soft">
                <span className="sm:hidden">{formatTime(currentTime)} / {formatTime(duration)}</span>
                <span className="hidden sm:inline">{isLoading ? '正在加载' : isPlaying ? '正在播放' : '已暂停'}{currentTrack.artist ? ` · ${currentTrack.artist}` : ''}</span>
              </p>
            </div>
          </div>

          {/* 中间：播放控制 */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button type="button" onClick={() => skip(-15)} aria-label="后退 15 秒" className="ys-icon-btn hidden h-9 w-9 sm:inline-grid">
              <RotateCcw className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            {playButton('md')}
            <button type="button" onClick={() => skip(15)} aria-label="前进 15 秒" className="ys-icon-btn hidden h-9 w-9 sm:inline-grid">
              <RotateCw className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <div className="ml-2 hidden items-center gap-2.5 text-xs tabular-nums text-ink-soft lg:flex">
              <span>{formatTime(currentTime)}</span>
              <input type="range" min={0} max={duration || 0} step={0.1} value={currentTime} onChange={e => seek(parseFloat(e.target.value))}
                aria-label="播放进度" className="ys-range w-64 xl:w-80" />
              <span>{formatTime(duration)}</span>
            </div>
            <button type="button" onClick={() => setIsExpanded(true)} id="global-audio-player-expand-button" aria-label="展开播放器" className="ys-icon-btn h-9 w-9 sm:hidden">
              <ChevronUp className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>

          {/* 右侧：控制按钮 */}
          <div className="hidden items-center justify-end gap-1.5 sm:flex">
            <span className="hidden lg:inline-flex">{rateSelect}</span>
            <button type="button" onClick={toggleMute} aria-label={isMuted ? '取消静音' : '静音'} className="ys-icon-btn h-9 w-9">
              {isMuted ? <VolumeX className="h-[18px] w-[18px]" aria-hidden="true" /> : <Volume2 className="h-[18px] w-[18px]" aria-hidden="true" />}
            </button>
            <input type="range" min="0" max="1" step="0.1" value={isMuted ? 0 : volume} onChange={e => setVolume(parseFloat(e.target.value))}
              aria-label="音量" className="ys-range hidden w-20 md:block" />
            <button type="button" onClick={() => setIsExpanded(true)} aria-label="展开播放器" className="ys-icon-btn h-9 w-9">
              <ChevronUp className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <button type="button" onClick={hide} aria-label="关闭播放器" className="ys-icon-btn h-9 w-9">
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>}

        {/* 展开模式 */}
        {isExpanded && <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-ink-soft">{isLoading ? '正在加载' : isPlaying ? '正在播放' : '已暂停'}</p>
              <h3 className="truncate text-base font-semibold text-ink">{currentTrack.title}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => setIsExpanded(false)} aria-label="收起播放器" className="ys-icon-btn h-9 w-9">
                <ChevronDown className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
              <button type="button" onClick={hide} aria-label="关闭播放器" className="ys-icon-btn h-9 w-9">
                <X className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs tabular-nums text-ink-soft">
            <span>{formatTime(currentTime)}</span>
            <input type="range" min={0} max={duration || 0} step={0.1} value={currentTime} onChange={e => seek(parseFloat(e.target.value))}
              aria-label="播放进度" className="ys-range flex-1" />
            <span>{formatTime(duration)}</span>
          </div>

          <div className="flex items-center justify-center gap-4">
            <button type="button" onClick={() => skip(-15)} aria-label="后退 15 秒" className="ys-icon-btn">
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
            </button>
            {playButton('lg')}
            <button type="button" onClick={() => skip(15)} aria-label="前进 15 秒" className="ys-icon-btn">
              <RotateCw className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            {rateSelect}
            <div className="flex items-center gap-2">
              <button type="button" onClick={toggleMute} aria-label={isMuted ? '取消静音' : '静音'} className="ys-icon-btn h-9 w-9">
                {isMuted ? <VolumeX className="h-[18px] w-[18px]" aria-hidden="true" /> : <Volume2 className="h-[18px] w-[18px]" aria-hidden="true" />}
              </button>
              <input type="range" min="0" max="1" step="0.1" value={isMuted ? 0 : volume} onChange={e => setVolume(parseFloat(e.target.value))}
                aria-label="音量" className="ys-range w-28" />
            </div>
          </div>
        </div>}
      </div>

      {/* 底部占位符，避免内容被播放器遮挡 */}
      <div className={isExpanded ? 'h-56' : 'h-16 sm:h-[4.5rem]'} aria-hidden="true" />
    </>
  );
}

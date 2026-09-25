'use client';

import { useState } from 'react';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/solid';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useTranslation } from 'react-i18next';
import { formatTime } from '@/utils/time';

export default function GlobalAudioPlayer() {
  const {t} = useTranslation('global-audio-player');
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
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // 播放速度选项数组
  const playbackRates = [0.7, 0.8, 0.9, 1, 1.25, 1.5, 2];

  // 注意：formatTime 函数已移至 @/utils/time

  // 播放/暂停切换
  const handleTogglePlay = () => {
    if (isPlaying || isLoading) {
      pause();
    } else {
      resume();
    }
  };

  // 进度条变化
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    seek(time);
  };

  // 音量控制
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  if (!isVisible || !currentTrack) {
    return null;
  }

  return (
    <>
      {/* 底部固定播放器 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-white/95 to-gray-50/95 dark:from-gray-900/95 dark:to-gray-800/95 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-700/50 shadow-2xl">
        {/* 紧凑模式 */}
        <div className={`relative transition-all duration-300 ${isExpanded ? 'h-0 overflow-hidden' : 'h-16 sm:h-20'}`}>
          {/* 进度条 */}
          <div className="absolute top-0 left-0 w-full h-0.5">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-100"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>

          <div className="flex items-center justify-between h-full px-4 sm:px-6">
            {/* 左侧：播放信息 */}
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {currentTrack.thumbnail && (
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover shadow-md"
                />
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white truncate">
                  {currentTrack.title}
                </h4>
                <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {currentTrack.artist && (
                    <span className="truncate">{currentTrack.artist}</span>
                  )}
                  {duration > 0 && (
                    <>
                      {currentTrack.artist && <span>•</span>}
                      <span>{formatTime(duration)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 中间：播放控制 */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={handleTogglePlay}
                aria-label={isPlaying || isLoading ? '暂停播放' : '播放音频'}
                className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center hover:scale-105 transition-all duration-300 shadow-lg disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : isPlaying ? (
                  <PauseIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                ) : (
                  <PlayIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white ml-0.5" />
                )}
              </button>

              {/* 播放速度选择器（紧凑模式，中间） */}
              <div className="hidden lg:flex relative ml-4">
                <select
                  className="relative bg-gradient-to-br from-white/80 to-gray-100/60 dark:from-gray-700/80 dark:to-gray-800/60 backdrop-blur-sm rounded-2xl px-3 py-1.5 text-xs font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 border-0 cursor-pointer text-gray-700 dark:text-gray-200"
                  value={playbackRate}
                  onChange={e => setPlaybackRate(Number(e.target.value))}
                  title={t('playback_rate_tooltip')}
                >
                  {/* 使用数组渲染播放速度选项 */}
                  {playbackRates.map(rate => (
                    <option key={rate} value={rate}>{rate}x</option>
                  ))}
                </select>
                {/* 顶部光泽效果 */}
                <div className="absolute inset-x-1 top-0.5 h-2 bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full pointer-events-none"></div>
              </div>
            </div>

            {/* 右侧：控制按钮 */}
            <div className="flex items-center space-x-2">
              {/* 音量控制（桌面端） */}
              <div className="hidden sm:flex items-center space-x-2">
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {isMuted ? (
                    <SpeakerXMarkIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <SpeakerWaveIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer slider-sm"
                />
              </div>

              {/* 展开/收起按钮 */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                id='global-audio-player-expand-button'
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronUpIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                )}
              </button>

              {/* 关闭按钮 */}
              <button
                onClick={hide}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <XMarkIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* 展开模式 */}
        <div className={`transition-all duration-300 ${isExpanded ? 'h-auto py-4' : 'h-0 overflow-hidden'}`}>
          <div className="px-4 sm:px-6 space-y-4">
            {/* 顶部控制栏 */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('playing')}</h4>
              <div className="flex items-center space-x-2">
                {/* 收起按钮 */}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 rounded-xl bg-gradient-to-br from-white/60 to-gray-100/40 dark:from-gray-700/60 dark:to-gray-800/40 backdrop-blur-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-105 shadow-md"
                  title={t('collapse_player')}
                >
                  <ChevronDownIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                {/* 关闭按钮 */}
                <button
                  onClick={hide}
                  className="p-2 rounded-xl bg-gradient-to-br from-white/60 to-gray-100/40 dark:from-gray-700/60 dark:to-gray-800/40 backdrop-blur-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-300 hover:scale-105 shadow-md"
                  title={t('close_player')}
                >
                  <XMarkIcon className="w-4 h-4 text-gray-600 dark:text-gray-400 hover:text-red-500" />
                </button>
              </div>
            </div>

            {/* 播放信息 */}
            <div className="flex items-center space-x-4">
              {currentTrack.thumbnail && (
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className="w-16 h-16 rounded-xl object-cover shadow-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {currentTrack.title}
                </h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  {currentTrack.artist && (
                    <span>{currentTrack.artist}</span>
                  )}
                  {duration > 0 && (
                    <>
                      {currentTrack.artist && <span>•</span>}
                      <span>总时长 {formatTime(duration)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 播放控制 */}
            <div className="flex flex-col space-y-3">
              {/* 进度条 */}
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right,
                      rgb(99 102 241) 0%,
                      rgb(168 85 247) ${duration ? (currentTime / duration) * 100 : 0}%,
                      rgb(229 231 235) ${duration ? (currentTime / duration) * 100 : 0}%,
                      rgb(229 231 235) 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* 播放速度选择器（展开模式，进度条下方） */}
              <div className="flex items-center justify-between bg-gradient-to-r from-gray-50/80 to-white/60 dark:from-gray-700/80 dark:to-gray-800/60 backdrop-blur-sm rounded-2xl p-3 shadow-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('playback_rate')}</span>
                <select
                  className="bg-gradient-to-br from-white/90 to-gray-100/70 dark:from-gray-600/90 dark:to-gray-700/70 backdrop-blur-sm rounded-xl px-3 py-2 text-sm font-medium shadow-inner hover:shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 border-0 cursor-pointer text-gray-700 dark:text-gray-200 min-w-[60px]"
                  value={playbackRate}
                  onChange={e => setPlaybackRate(Number(e.target.value))}
                >
                  {/* 使用数组渲染播放速度选项 */}
                  {playbackRates.map(rate => (
                    <option key={rate} value={rate}>{rate}x</option>
                  ))}
                </select>
                {/* 内部光泽效果 */}
                <div className="absolute inset-x-1 top-1 h-1.5 bg-gradient-to-r from-transparent via-white/50 to-transparent rounded-full pointer-events-none"></div>
              </div>

              {/* 音量控制（展开模式，桌面端） */}
              <div className="hidden sm:flex items-center justify-between bg-gradient-to-r from-gray-50/80 to-white/60 dark:from-gray-700/80 dark:to-gray-800/60 backdrop-blur-sm rounded-2xl p-3 shadow-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('volume')}</span>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={toggleMute}
                    className="p-2 rounded-xl bg-gradient-to-br from-white/60 to-gray-100/40 dark:from-gray-600/60 dark:to-gray-700/40 backdrop-blur-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-105 shadow-md"
                  >
                    {isMuted ? (
                      <SpeakerXMarkIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <SpeakerWaveIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer slider-sm"
                  />
                </div>
              </div>

              {/* 控制按钮组 */}
              <div className="flex items-center justify-center space-x-6">
                <button
                  onClick={handleTogglePlay}
                  aria-label={isPlaying || isLoading ? '暂停播放' : '播放音频'}
                  className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center hover:scale-105 transition-all duration-300 shadow-lg disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : isPlaying ? (
                    <PauseIcon className="w-6 h-6 text-white" />
                  ) : (
                    <PlayIcon className="w-6 h-6 text-white ml-0.5" />
                  )}
                </button>
              </div>

              {/* 音量控制（移动端） */}
              <div className="sm:hidden flex items-center justify-center space-x-4">
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800"
                >
                  {isMuted ? (
                    <SpeakerXMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <SpeakerWaveIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer slider-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部占位符，避免内容被播放器遮挡 */}
      <div className={`${isExpanded ? 'h-48' : 'h-16 sm:h-20'} transition-all duration-300`} />

      {/* CSS样式 */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(45deg, rgb(99 102 241), rgb(168 85 247));
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          transition: transform 0.2s;
        }

        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .slider-sm::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: linear-gradient(45deg, rgb(99 102 241), rgb(168 85 247));
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(45deg, rgb(99 102 241), rgb(168 85 247));
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }

        .slider-sm::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: linear-gradient(45deg, rgb(99 102 241), rgb(168 85 247));
          cursor: pointer;
          border: none;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </>
  );
}

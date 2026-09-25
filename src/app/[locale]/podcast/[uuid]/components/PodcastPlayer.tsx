'use client';

import { PlayIcon, PauseIcon, ClockIcon, ArrowDownTrayIcon } from '@heroicons/react/24/solid';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useTranslation } from 'react-i18next';
import { formatDuration } from '@/utils/time';

interface PodcastPlayerProps {
  audioUrl: string;
  downloadUrl?: string;
  title: string;
  artist?: string;
  thumbnail?: string;
  duration?: number;
  lyricsUrl?: string;
}

export default function PodcastPlayer({ audioUrl, downloadUrl, title, artist, thumbnail, duration, lyricsUrl }: PodcastPlayerProps) {
  const { play, pause, resume, currentTrack, isPlaying, isLoading } = useAudioPlayer();
  const {t} = useTranslation('podcast');

  // 检查是否是当前正在播放的音频
  const isCurrentTrack = currentTrack?.url === audioUrl;

  // 开始播放
  const handlePlay = () => {
    if (!audioUrl) return; // 如果没有音频URL，则不执行任何操作

    if (isCurrentTrack) {
      if (isPlaying || isLoading) pause();
      else resume();
      return;
    }

    play({
      id: audioUrl, // 使用URL作为唯一ID
      url: audioUrl,
      title,
      artist,
      thumbnail,
      duration,
    });
  };

  return (
    <div className="relative bg-gradient-to-br from-white/90 to-gray-50/80 dark:from-gray-800/90 dark:to-gray-900/80 backdrop-blur-sm rounded-3xl p-4 sm:p-6 shadow-xl">
      {/* 顶部光泽效果 */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-white/60 to-transparent rounded-full"></div>
      
      {/* 播放器主体 */}
      <div className="flex flex-col items-center space-y-4">
        {/* 音频信息 */}
        <div className="text-center">
          {artist && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {artist}
            </p>
          )}
          {/* 时长显示 */}
          {duration && (
            <div className="flex items-center justify-center space-x-1 mt-2">
              <ClockIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formatDuration(duration)}
              </span>
            </div>
          )}
        </div>

        {/* 缩略图 */}
        {thumbnail && (
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden shadow-lg">
            <img 
              src={thumbnail} 
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* 按钮容器 */}
        <div className="flex items-center justify-center space-x-6 py-4">
          {/* 播放按钮 */}
          <button
            onClick={handlePlay}
            disabled={!audioUrl}
            aria-label={isCurrentTrack && (isPlaying || isLoading) ? '暂停播放' : '播放音频'}
            className="group relative w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* 按钮内部光泽 */}
            <div className="absolute inset-1.5 bg-gradient-to-br from-white/20 to-transparent rounded-xl"></div>
            
            {isLoading && isCurrentTrack ? (
              <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : isPlaying && isCurrentTrack ? (
              <PauseIcon className="w-6 h-6 sm:w-8 sm:h-8 text-white relative z-10" />
            ) : (
              <PlayIcon className="w-6 h-6 sm:w-8 sm:h-8 text-white relative z-10 ml-0.5" />
            )}
          </button>
          {/* 下载按钮 */}
          <a
            href={downloadUrl || audioUrl || undefined}
            download={audioUrl ? `${title}.mp3` : undefined}
            title={audioUrl ? t('download') || 'Download' : 'Audio not available'}
            className={`group relative w-12 h-12 sm:w-14 sm:h-14 bg-white/30 dark:bg-gray-700/60 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md backdrop-blur-sm ${
              audioUrl ? 'hover:scale-105 hover:shadow-lg' : 'opacity-50 cursor-not-allowed'
            }`}
            onClick={(e) => {
              if (!audioUrl) e.preventDefault();
            }}
          >
            <ArrowDownTrayIcon className="w-6 h-6 sm:w-7 sm:h-7 text-gray-800 dark:text-gray-200 transition-colors duration-300 group-hover:text-indigo-500 dark:group-hover:text-purple-400" />
          </a>
          {lyricsUrl && <a href={lyricsUrl} download title="下载同步歌词 (.lrc)"
            className="rounded-xl bg-white/60 px-3 py-3 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-100">下载歌词</a>}
        </div>

        {/* 状态指示 */}
        {isCurrentTrack && (
          <div className="flex items-center space-x-2 text-sm">
            {isPlaying ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-600 dark:text-green-400">{t('playing')}</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-400">{t('paused')}</span>
              </>
            )}
          </div>
        )}

        {/* 提示文本 */}
        <p className="text-xs text-gray-500 dark:text-gray-500 text-center max-w-xs">
          {t('click_play_button_to_start_listening')}
        </p>
        {lyricsUrl && <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          网易云可能忽略自制音频的本地歌词。<a href="#synchronized-script" className="font-medium text-indigo-600 underline dark:text-indigo-300">在本站查看同步脚本</a>，或下载 LRC 用支持本地歌词的播放器打开。
        </p>}
      </div>
    </div>
  );
}

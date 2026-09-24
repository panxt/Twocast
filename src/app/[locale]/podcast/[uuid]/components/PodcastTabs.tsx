'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ScriptItem } from '@/lib/podcast/types';
import { useTranslation } from 'react-i18next';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';

interface PodcastTabsProps {
  outline: string;
  keyPoints: string;
  scripts: ScriptItem[];
  timedScript?: { role: string; text: string; startMs: number }[];
  audioUrl: string;
}

export default function PodcastTabs({ outline, keyPoints, scripts, timedScript, audioUrl }: PodcastTabsProps) {
  const [activeTab, setActiveTab] = useState<'outline' | 'scripts'>(timedScript?.length ? 'scripts' : 'outline');
  const {t} = useTranslation('podcast');
  const { currentTime, seek, currentTrack } = useAudioPlayer();
  const isCurrentTrack = currentTrack?.url === audioUrl;
  const activeLine = isCurrentTrack ? (timedScript?.findLastIndex(line => line.startMs <= currentTime * 1000) ?? -1) : -1;
  const scriptListRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (activeTab !== 'scripts' || activeLine < 0) return;
    const list = scriptListRef.current;
    const line = lineRefs.current[activeLine];
    if (!list || !line) return;
    const offset = line.getBoundingClientRect().top - list.getBoundingClientRect().top;
    const top = list.scrollTop + offset - (list.clientHeight - line.clientHeight) / 2;
    list.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [activeLine, activeTab]);

  const tabs = [
    { id: 'outline', label: t('outline'), labelMobile: t('outline') },
    { id: 'scripts', label: t('scripts'), labelMobile: t('scripts') },
  ] as const;

  return (
    <div id="synchronized-script" className="relative bg-gradient-to-br from-white/90 to-gray-50/80 dark:from-gray-800/90 dark:to-gray-900/80 backdrop-blur-sm rounded-3xl overflow-hidden shadow-xl">
      {/* 顶部光泽效果 */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-white/60 to-transparent rounded-full"></div>

      {/* 标签页导航 */}
      <div className="border-b border-gray-200/50 dark:border-gray-700/50">
        <nav className="flex p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:space-x-4 w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative px-3 py-2 sm:px-4 sm:py-3 rounded-2xl sm:rounded-3xl transition-all duration-300 text-base sm:text-lg font-medium
                  ${activeTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                    : 'bg-gradient-to-r from-gray-100/80 to-gray-200/60 dark:from-gray-700/80 dark:to-gray-800/60 text-gray-700 dark:text-gray-300 hover:from-gray-200/80 hover:to-gray-300/60 dark:hover:from-gray-600/80 dark:hover:to-gray-700/60 hover:scale-105'
                  }
                `}
              >
                {/* 按钮内部光泽 */}
                <div className="absolute inset-1 bg-gradient-to-br from-white/20 to-transparent rounded-xl sm:rounded-2xl pointer-events-none"></div>

                {/* 文字内容 */}
                <span className="relative z-10 block sm:hidden">{tab.labelMobile}</span>
                <span className="relative z-10 hidden sm:block">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* 标签页内容 */}
      <div className="p-4 sm:p-6">
        {/* 大纲标签页 */}
        <div className={`space-y-3 ${activeTab !== 'outline' ? 'hidden' : ''}`}>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            📋 {t('outline')}
          </h3>
          <div className="prose prose-gray dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-ul:text-gray-700 dark:prose-ul:text-gray-300 prose-ol:text-gray-700 dark:prose-ol:text-gray-300">
            <ReactMarkdown>{outline}</ReactMarkdown>
          </div>
        </div>


        {/* 完整脚本标签页 */}
        <div className={`space-y-3 ${activeTab !== 'scripts' ? 'hidden' : ''}`}>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            🎙️ {timedScript?.length ? '同步脚本' : t('scripts')}
          </h3>
          {timedScript?.length ? <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">播放时自动定位当前段落；点击时间可跳转。网易云若不显示本地歌词，可直接在这里边听边看。</p> : null}
          <div ref={scriptListRef} className="max-h-[min(65vh,640px)] space-y-2 overflow-y-auto overscroll-contain pr-2">
            {scripts.map((script, index) => (
              <div
                key={index}
                ref={element => { lineRefs.current[index] = element }}
                aria-current={activeLine === index ? 'true' : undefined}
                className={`relative px-3 py-2 sm:py-3 rounded-xl ${activeLine === index ? 'bg-indigo-100 ring-1 ring-indigo-300 dark:bg-indigo-900/40 dark:ring-indigo-700' : ''}`}
              >
                {/* 角色标签和内容在同一行 */}
                <div className="flex gap-3 items-start">
                  <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-indigo-500/90 to-purple-500/90 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xs sm:text-sm">
                      {script.role === 'host' ? '🎤' : '👤'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                        {script.role === 'host' ? t('role_host') : t('role_guest')}
                      </h4>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        #{index + 1}
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base sm:text-lg">
                      {script.text}
                    </p>
                    {timedScript?.[index] && <button type="button" onClick={() => seek(timedScript[index].startMs / 1000)} disabled={!isCurrentTrack}
                      className="mt-1 text-xs text-indigo-600 dark:text-indigo-300" aria-label={`跳转到第 ${index + 1} 段`}>
                      {Math.floor(timedScript[index].startMs / 60000)}:{String(Math.floor(timedScript[index].startMs / 1000) % 60).padStart(2, '0')}
                    </button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

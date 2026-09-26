'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ScriptItem } from '@/lib/podcast/types';
import { useTranslation } from '@/i18n/client';
import { useParams } from 'next/navigation';
import type { LocaleTypes } from '@/i18n/settings';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';

interface PodcastTabsProps {
  trackId: string;
  outline: string;
  keyPoints: string;
  scripts: ScriptItem[];
  timedScript?: { role: string; text: string; startMs: number }[];
}

const stamp = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

export default function PodcastTabs({ outline, keyPoints, scripts, timedScript, trackId }: PodcastTabsProps) {
  const [activeTab, setActiveTab] = useState<'outline' | 'scripts'>(timedScript?.length ? 'scripts' : 'outline');
  const locale = (useParams()?.locale || 'zh') as LocaleTypes;
  const { t } = useTranslation(locale, 'podcast');
  const { currentTime, seek, currentTrack } = useAudioPlayer();
  const isCurrentTrack = currentTrack?.id === trackId;
  const activeLine = isCurrentTrack ? (timedScript?.findLastIndex(line => line.startMs <= currentTime * 1000) ?? -1) : -1;
  const scriptListRef = useRef<HTMLOListElement>(null);
  const lineRefs = useRef<(HTMLLIElement | null)[]>([]);

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
    { id: 'scripts', label: timedScript?.length ? '同步脚本' : t('scripts') },
    { id: 'outline', label: t('outline') },
  ] as const;

  return (
    <section id="synchronized-script" aria-label="节目内容" className="ys-sheet flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3 sm:px-5">
        <div role="tablist" aria-label="节目内容" className="ys-seg grid-cols-2 sm:flex">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}
              className={`ys-seg-item min-h-9 px-4 ${activeTab === tab.id ? 'ys-seg-item-active' : ''}`}>
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === 'scripts' && timedScript?.length ? <span className="text-xs text-ink-soft">播放时自动跟随；点击时间可跳转</span> : null}
      </div>

      {activeTab === 'outline' && <div className="p-5 sm:p-6">
        <div className="prose prose-sm max-w-none text-ink prose-headings:font-display prose-headings:text-ink prose-p:text-ink prose-strong:text-ink prose-li:text-ink prose-a:text-brand sm:prose-base">
          <ReactMarkdown>{outline}</ReactMarkdown>
        </div>
        {keyPoints && <div className="mt-6 border-t border-rule pt-5">
          <h3 className="ys-title mb-3 text-lg">{t('keyPoints')}</h3>
          <div className="prose prose-sm max-w-none text-ink prose-p:text-ink prose-li:text-ink sm:prose-base"><ReactMarkdown>{keyPoints}</ReactMarkdown></div>
        </div>}
      </div>}

      {activeTab === 'scripts' && <ol ref={scriptListRef} className="flex max-h-[min(70vh,720px)] flex-col gap-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
        {scripts.map((script, index) => {
          const host = script.role === 'host'
          const timed = timedScript?.[index]
          const active = activeLine === index
          return (
            <li key={index} ref={element => { lineRefs.current[index] = element }} aria-current={active ? 'true' : undefined}
              className={`grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-control px-3 py-3 transition-colors sm:grid-cols-[3.5rem_4rem_minmax(0,1fr)] ${active ? 'bg-brand-tint' : ''}`}>
              {timed
                ? <button type="button" onClick={() => seek(timed.startMs / 1000)} disabled={!isCurrentTrack} aria-label={`跳转到第 ${index + 1} 段 ${stamp(timed.startMs)}`}
                    className="self-start text-left text-xs tabular-nums text-brand hover:underline disabled:cursor-default disabled:text-ink-faint disabled:no-underline">
                    {stamp(timed.startMs)}
                  </button>
                : <span className="text-xs tabular-nums text-ink-faint">#{index + 1}</span>}
              <span className={`text-xs font-semibold ${host ? 'text-brand' : 'text-voice'}`}>{host ? t('role_host') : t('role_guest')}</span>
              <p className="col-span-2 m-0 text-base leading-7 text-ink sm:col-span-1">{script.text}</p>
            </li>
          )
        })}
      </ol>}
    </section>
  );
}

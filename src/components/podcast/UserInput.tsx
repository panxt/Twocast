"use client";

import { apiRequest } from "@/lib/client-api/base";
import { Platform, PodcastInputType } from "@/lib/podcast/types";
import { useEffect, useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import { OptionItem, TcSelector } from "./TcSelector";
import { languages as minimaxLng } from "@/lib/podcast/languages/minimax";
import { languages as geminiLng } from "@/lib/podcast/languages/gemini";
import { languages as fishAudioLng } from "@/lib/podcast/languages/fish_audio";
import { CustomTextarea } from "./CustomTextarea";
import { useTranslation } from "react-i18next";
import { VoicePlayerButton } from "./VoicePlayerButton";
import { getPlatformDefaultVoices } from "@/lib/podcast/client_utils";
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getLocalePath } from '@/utils/locale-util';
import type { LocaleTypes } from '@/i18n/settings';
import { AlignLeft, CircleAlert, FileText, FileUp, Lightbulb, Link2, LoaderCircle, Mic, Newspaper, X } from 'lucide-react';

enum SelectType {
  Select = 'select',
  Input = 'input',
}

interface UserInputProps {
  onSubmitSuccess?: () => void;
}

const tabIcons: Record<PodcastInputType, React.ComponentType<{ className?: string }>> = {
  [PodcastInputType.Topic]: Lightbulb,
  [PodcastInputType.Link]: Link2,
  [PodcastInputType.File]: FileUp,
  [PodcastInputType.LongText]: AlignLeft,
  [PodcastInputType.FrontPage]: Newspaper,
};

export function UserInput({ onSubmitSuccess }: UserInputProps) {
  const { t, i18n } = useTranslation('podcast');
  const locale = (useParams()?.locale || 'zh') as LocaleTypes;
  const [drafts, setDrafts] = useState<Partial<Record<PodcastInputType, string>>>({});
  const [activeTab, setActiveTab] = useState(PodcastInputType.Topic);
  const topic = drafts[activeTab] || '';
  const setTopic = (value: string) => setDrafts(current => ({ ...current, [activeTab]: value }));
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [submitPhase, setSubmitPhase] = useState<'upload' | 'processing'>('processing');
  const [platform, setPlatform] = useState(Platform.Minimax.toString());
  const [voiceId_1, setVoiceId_1] = useState('');
  const [voiceId_2, setVoiceId_2] = useState('');
  const [outputLanguage, setOutputLanguage] = useState('auto');
  const [voices, setVoices] = useState<Record<string, { id: string; name: string; icon?: string; sample?: string }[]>>({});
  const [voiceOptions, setVoiceOptions] = useState<OptionItem[]>([]);
  const [selectType, setSelectType] = useState(SelectType.Select);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [apiWarning, setApiWarning] = useState('');
  const [voiceLoadError, setVoiceLoadError] = useState('');
  const [voiceReload, setVoiceReload] = useState(0);
  const [dragging, setDragging] = useState(false);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});
  const readyToSubmit = Boolean(platform && voiceId_1 && voiceId_2 &&
    (activeTab === PodcastInputType.File ? file : topic.trim()));

  const tabs = [
    { id: PodcastInputType.Topic, label: t('tabs.topic') },
    { id: PodcastInputType.Link, label: t('tabs.link') },
    { id: PodcastInputType.File, label: t('tabs.upload_file') },
    { id: PodcastInputType.LongText, label: t('tabs.long_text') },
    ...(process.env.NEXT_PUBLIC_VERCEL_BETA === '1' ? [] : [{ id: PodcastInputType.FrontPage, label: t('tabs.front_page') }]),
  ];

  const platforms: OptionItem[] = [
    { id: Platform.Minimax, label: 'MiniMax', icon: '' },
    { id: Platform.Gemini, label: 'Gemini TTS', icon: '' },
    { id: Platform.FishAudio, label: 'Fish Audio', icon: '' },
  ]
  const lngOpt2OptionItem = (lngs: any[]) => {
    const audoOpt = [{
      id: 'auto',
      label: t('auto'),
      icon: '',
      description: t('depends_on_source_language')
    }]
    return [...audoOpt, ...lngs.map(l => ({
      id: l.code,
      label: l.label,
      icon: ''
    }))]
  }
  const languages = {
    [Platform.Minimax]: lngOpt2OptionItem(minimaxLng),
    [Platform.Gemini]: lngOpt2OptionItem(geminiLng),
    [Platform.FishAudio]: lngOpt2OptionItem(fishAudioLng),
    [Platform.FishAudio + '_custom']: lngOpt2OptionItem(fishAudioLng),
  }
  const platformDefaultVoices = useMemo(() => getPlatformDefaultVoices(i18n.language), [i18n.language])

  const platformTips = {
    [Platform.Minimax]: 'https://platform.minimaxi.com/examination-center/voice-experience-center/t2a_v2',
    // [Platform.Gemini]: 'Gemini',
    [Platform.FishAudio]: 'https://fish.audio/developers/',
  }

  useEffect(() => {
    let active = true;
    const fetchVoices = async () => {
      try {
        const response = await fetch('/api/voices', { cache: 'no-store' });
        if (!response.ok) throw new Error('音色列表加载失败');
        const body = await response.json();
        if (body.code !== 0) throw new Error(body.message || '音色列表加载失败');
        if (active) {
          setVoices(body.data || {});
          setVoiceLoadError('');
        }
      } catch {
        if (active) setVoiceLoadError('音色列表暂时无法加载。');
      }
    }
    fetchVoices()
    return () => { active = false };
  }, [voiceReload]);

  useEffect(() => {
    fetch(`/api/user/settings?platform=${encodeURIComponent(platform)}`).then(response => response.json()).then(data => {
      setApiWarning(data.access?.llm?.error || data.access?.tts?.error || '');
    }).catch(() => undefined);
  }, [platform]);

  useEffect(() => {
    if (platform) {
      if (platform === Platform.FishAudio) {
        setSelectType(SelectType.Input);
      } else {
        setSelectType(SelectType.Select);
        const availableVoices = voices[platform] || [];
        const fallback: typeof availableVoices = platform === Platform.Minimax
          ? [
            { id: platformDefaultVoices[Platform.Minimax].voiceId_1, name: '默认主持人 A' },
            { id: platformDefaultVoices[Platform.Minimax].voiceId_2, name: '默认主持人 B' },
          ].filter(item => !availableVoices.some(voice => voice.id === item.id)) : [];
        if (availableVoices.length || fallback.length) {
          setVoiceOptions([...availableVoices, ...fallback].map(v => {
            return {
              id: v.id,
              label: v.name,
              icon: v.icon || '',
              render: (option: OptionItem) => {
                return (
                  <VoicePlayerButton
                    key={v.id}
                    id={v.id}
                    sample={v.sample || ''}
                    label={option.label}
                    playingVoiceId={playingVoiceId}
                    setPlayingVoiceId={setPlayingVoiceId}
                    audioRefs={audioRefs}
                  />
                );
              }
            }
          }))
        } else {
          setVoiceOptions([])
        }
      }
      // set voice id
      if (platformDefaultVoices[platform as Platform]) {
        setVoiceId_1(platformDefaultVoices[platform as Platform].voiceId_1)
        setVoiceId_2(platformDefaultVoices[platform as Platform].voiceId_2)
      }
    }
  }, [platform, voices, playingVoiceId, platformDefaultVoices])

  useEffect(() => {
    // 当 platform 或 voices 变化时，重置播放状态
    setPlayingVoiceId(null);
    // 暂停所有 audio
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  }, [platform, voices]);

  const resetFile = () => {
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    setFile(null);
  };

  const acceptFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (candidate.size > 4_000_000) {
      toast.error('文件大小须在 4 MB 以内');
      setFile(null);
      return;
    }
    if (!/\.(pdf|txt|md|text)$/i.test(candidate.name)) {
      toast.error('只支持 PDF、TXT、Markdown');
      setFile(null);
      return;
    }
    setFile(candidate);
  };

  const handleSubmit = async () => {
    if (!readyToSubmit) return;
    setLoading(true);
    setUploadPercent(null);
    setSubmitPhase(activeTab === PodcastInputType.File ? 'upload' : 'processing');
    try {
      const formData = new FormData();
      formData.append("type", activeTab);
      formData.append("platform", platform);
      formData.append("voice_id_1", voiceId_1);
      formData.append("voice_id_2", voiceId_2);
      formData.append("language", outputLanguage);
      if (activeTab == PodcastInputType.File) {
        formData.append("file", file as File);
      } else {
        formData.append("text", topic);
      }
      const response = await apiRequest({
        url: "/api/protected/gen-podcast",
        method: "POST",
        data: formData,
        onUploadProgress: activeTab === PodcastInputType.File ? event => {
          if (!event.total) return;
          const percent = Math.min(100, Math.round(event.loaded / event.total * 100));
          setUploadPercent(percent);
          if (percent === 100) setSubmitPhase('processing');
        } : undefined,
      });
      if (response.data?.code !== 0) throw new Error(response.data?.message || '提交失败');
      toast.success("节目已进入队列，稍后在节目库查看进度");
      setDrafts(current => ({ ...current, [activeTab]: '' }));
      if (activeTab === PodcastInputType.File) resetFile();
      onSubmitSuccess?.();
    } catch (error) {
      console.error(error);
      if (error instanceof Error && !('response' in error)) toast.error(error.message);
    } finally {
      setLoading(false);
      setUploadPercent(null);
    }
  };

  const handleTabChange = (tabId: PodcastInputType) => {
    if (loading) return;
    setActiveTab(tabId);
  };

  const renderInputSection = () => {
    const inputDisabled = loading;
    switch (activeTab) {
      case PodcastInputType.Topic:
        return <CustomTextarea value={topic} onChange={setTopic} placeholder={t('placeholder.topic')} rows={5} disabled={inputDisabled} label="这期想聊什么" />;

      case PodcastInputType.Link:
        return <CustomTextarea value={topic} onChange={setTopic} placeholder={t('placeholder.link')} rows={3} disabled={inputDisabled} label="要讲的网页" />;

      case PodcastInputType.FrontPage:
        return <CustomTextarea value={topic} onChange={setTopic} placeholder={t('placeholder.front_page')} rows={3} disabled={inputDisabled} label="要浏览的列表页" />;

      case PodcastInputType.LongText:
        return <CustomTextarea value={topic} onChange={setTopic} placeholder={t('placeholder.long_text')} rows={6} disabled={inputDisabled} label="资料正文" />;

      case PodcastInputType.File:
        return (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink">要讲的文件</span>
            <div
              onDragOver={event => { event.preventDefault(); if (!inputDisabled) setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={event => { event.preventDefault(); setDragging(false); if (!inputDisabled) acceptFile(event.dataTransfer.files?.[0]); }}
              className={`flex flex-col items-center gap-3 rounded-control border border-dashed px-6 py-8 text-center transition-colors ${dragging ? 'border-brand bg-brand-tint' : 'border-rule-strong bg-paper'}`}
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-tint text-brand">
                <FileUp className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold text-ink">{t('placeholder.upload_file')}</p>
              <p className="text-xs text-ink-soft">{t('placeholder.upload_file_tips')}；扫描版 PDF 暂不支持文字识别</p>
              <input
                type="file"
                accept=".pdf,.txt,.md,.text"
                className="sr-only"
                onChange={(e) => { acceptFile(e.target.files?.[0]); if (!e.target.files?.[0]) e.target.value = ''; }}
                id="file-upload"
                disabled={inputDisabled}
              />
              <label htmlFor="file-upload" className={`ys-btn ys-btn-secondary cursor-pointer ${inputDisabled ? 'pointer-events-none opacity-50' : ''}`}>
                选择文件
              </label>
            </div>

            {file && (
              <div className="flex items-center gap-3 rounded-control border border-voice-rail bg-voice-tint px-3 py-2.5 text-sm text-voice-deep">
                <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                <span className="shrink-0 text-xs tabular-nums">{(file.size / 1024).toFixed(0)} KB</span>
                <button type="button" onClick={resetFile} aria-label="移除文件" className="grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-sheet">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 资料来源 */}
      <div role="tablist" aria-label="资料来源" className="ys-seg grid-cols-4 sm:flex">
        {tabs.map((tab) => {
          const Icon = tabIcons[tab.id];
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleTabChange(tab.id)}
              className={`ys-seg-item flex-1 ${active ? 'ys-seg-item-active' : ''}`}
              disabled={loading}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {renderInputSection()}

      {apiWarning && <div role="status" className="ys-note flex items-start gap-2 bg-warn-tint text-warn-deep">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{apiWarning} <Link href={getLocalePath(locale, '/settings')} className="font-semibold underline">查看 API 配置与授权</Link></span>
      </div>}
      {voiceLoadError && <div role="alert" className="ys-note flex items-start gap-2 bg-warn-tint text-warn-deep">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{voiceLoadError} <button type="button" onClick={() => setVoiceReload(value => value + 1)} className="font-semibold underline">重新加载</button></span>
      </div>}

      {/* 配音 */}
      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold text-ink">配音</span>
        <div className="grid gap-3 sm:grid-cols-2">
          <TcSelector value={platform} onChange={(v) => {
            setPlatform(v);
            setOutputLanguage(current => languages[v as Platform]?.some(option => option.id === current) ? current : 'auto');
            if (v.includes('custom')) {
              setVoiceId_1('');
              setVoiceId_2('');
            }
          }} options={platforms} title={t('platform')} />
          <TcSelector value={outputLanguage} onChange={setOutputLanguage} options={languages[platform as Platform]} title={t('output_language')} />
          {selectType == SelectType.Select && <TcSelector value={voiceId_1} onChange={setVoiceId_1} options={voiceOptions} title={t('voice_1')} />}
          {selectType == SelectType.Select && <TcSelector value={voiceId_2} onChange={setVoiceId_2} options={voiceOptions} title={t('voice_2')} />}
          {selectType == SelectType.Input && <label className="min-w-0">
            <span className="ys-label mb-1.5">{t('voice_1')}</span>
            <input type="text" value={voiceId_1} onChange={(e) => setVoiceId_1(e.target.value)} placeholder="Fish Audio Voice ID" className="ys-field" />
          </label>}
          {selectType == SelectType.Input && <label className="min-w-0">
            <span className="ys-label mb-1.5">{t('voice_2')}</span>
            <input type="text" value={voiceId_2} onChange={(e) => setVoiceId_2(e.target.value)} placeholder="Fish Audio Voice ID" className="ys-field" />
          </label>}
        </div>
      </div>

      {/* 提交 */}
      <div className="flex flex-col-reverse items-stretch gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        {platformTips[platform as Platform] ? (
          <a href={platformTips[platform as Platform]} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:text-brand-hover">
            {t('more_voices_about', { platform: platforms.find(p => p.id == platform)?.label })}
          </a>
        ) : <span />}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!readyToSubmit || loading}
          className="ys-btn ys-btn-primary h-12 px-7 text-[15px]"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
          {loading ? t('create_button_loading') : t('create_button')}
        </button>
      </div>

      {loading && <div role="status" className="ys-note bg-voice-tint text-voice-deep">
        <p>{submitPhase === 'upload' ? `正在上传文件${uploadPercent === null ? '…' : ` ${uploadPercent}%`}` : '正在解析资料并创建任务…'}</p>
        {submitPhase === 'upload' && <div role="progressbar" aria-label="文件上传进度" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={uploadPercent ?? undefined} className="mt-2 h-1.5 overflow-hidden rounded-full bg-voice-rail">
          <div className="h-full rounded-full bg-voice transition-[width]" style={{ width: `${uploadPercent ?? 0}%` }} />
        </div>}
        <p className="mt-1 text-xs opacity-80">创建后可在右侧节目库看到生成进度。</p>
      </div>}
    </div>
  );
}

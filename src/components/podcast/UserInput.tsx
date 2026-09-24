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
import { FaCoins } from "react-icons/fa";
import { getPlatformDefaultVoices } from "@/lib/podcast/client_utils";
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getLocalePath } from '@/utils/locale-util';
import type { LocaleTypes } from '@/i18n/settings';

enum SelectType {
  Select = 'select',
  Input = 'input',
}

interface UserInputProps {
  onSubmitSuccess?: () => void;
}

export function UserInput({ onSubmitSuccess }: UserInputProps) {
  const { t, i18n } = useTranslation('podcast');
  const locale = (useParams()?.locale || 'zh') as LocaleTypes;
  const [topic, setTopic] = useState("");
  const [activeTab, setActiveTab] = useState(PodcastInputType.Topic);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const [platform, setPlatform] = useState(Platform.Minimax.toString());
  const [voiceId_1, setVoiceId_1] = useState('');
  const [voiceId_2, setVoiceId_2] = useState('');
  const [outputLanguage, setOutputLanguage] = useState('auto');
  const [voices, setVoices] = useState({});
  const [voiceOptions, setVoiceOptions] = useState([]);
  const [selectType, setSelectType] = useState(SelectType.Select);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [apiWarning, setApiWarning] = useState('');
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  // 监听 playingVoiceId 状态变化
  useEffect(() => {
    console.log('Main component - playingVoiceId changed to:', playingVoiceId);
  }, [playingVoiceId]);

  const tabs = [
    { id: PodcastInputType.Topic, label: t('tabs.topic'), icon: "🧠" },
    { id: PodcastInputType.Link, label: t('tabs.link'), icon: "🔗" },
    { id: PodcastInputType.File, label: t('tabs.upload_file'), icon: "📁" },
    { id: PodcastInputType.LongText, label: t('tabs.long_text'), icon: "📄" },
    ...(process.env.NEXT_PUBLIC_VERCEL_BETA === '1' ? [] : [{ id: PodcastInputType.FrontPage, label: t('tabs.front_page'), icon: "🌐" }]),
  ];

  const platforms: OptionItem[] = [
    { id: Platform.Minimax, label: 'Minimax', icon: '🤖' },
    ...(process.env.NEXT_PUBLIC_VERCEL_BETA === '1' ? [] : [
      { id: Platform.Gemini, label: 'Gemini', icon: '🤖' },
      { id: Platform.FishAudio, label: 'Fish Audio', icon: '🐟' },
      { id: Platform.FishAudio + '_custom', label: 'Fish Audio (Custom)', icon: '🐟' },
    ]),
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
    [Platform.FishAudio]: 'http://bit.ly/4k7AXHt',
    [Platform.FishAudio + '_custom']: 'http://bit.ly/4k7AXHt',
  }

  useEffect(() => {
    const fetchVoices = async () => {
      const resp = await apiRequest({
        url: '/api/voices',
        method: 'GET',
      })
      setVoices(resp.data.data)
    }
    fetchVoices()
  }, []);

  useEffect(() => {
    fetch('/api/user/settings').then(response => response.json()).then(data => {
      setApiWarning(data.access?.llm?.error || data.access?.tts?.error || '');
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (platform) {
      console.log('platform', platform)
      // setVoiceId_1('');
      // setVoiceId_2('');
      if (platform.includes('custom')) {
        setSelectType(SelectType.Input);
      } else {
        setSelectType(SelectType.Select);
        if (voices[platform]) {
          setVoiceOptions(voices[platform].map(v => {
            return {
              id: v.id,
              label: v.name,
              icon: v.icon,
              render: (option: OptionItem) => {
                return (
                  <VoicePlayerButton
                    key={v.id}
                    id={v.id}
                    sample={v.sample}
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
    const isReadyToSubmit = () => {
      if (!platform || !voiceId_1 || !voiceId_2) {
        return false;
      }
      if (activeTab == PodcastInputType.File) {
        return !!file;
      } else {
        return !!topic.trim();
      }
    }
    setReadyToSubmit(isReadyToSubmit());
    // console.log('file', file, 'topic', topic, 'readyToSubmit', readyToSubmit);
  }, [file, topic, activeTab, platform, voiceId_1, voiceId_2]);

  useEffect(() => {
    // 当 platform 或 voices 变化时，重置播放状态
    console.log('Platform/voices changed, resetting playingVoiceId. Platform:', platform, 'Voices keys:', Object.keys(voices));
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

  const handleSubmit = async () => {
    if (!readyToSubmit) return;
    setLoading(true);
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
      });
      if (response.data?.code !== 0) throw new Error(response.data?.message || '提交失败');
      toast.success("任务已提交");
      setTopic("");
      resetFile();
      // setActiveTab(PodcastInputType.Topic);
      onSubmitSuccess?.();
    } catch (error) {
      console.error(error);
      if (error instanceof Error && !('response' in error)) toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tabId: PodcastInputType) => {
    if (loading) return;
    setActiveTab(tabId);
    setTopic(""); // 清空输入内容
  };

  const renderInputSection = () => {
    const inputDisabled = loading;
    switch (activeTab) {
      case PodcastInputType.Topic:
        return (
          <CustomTextarea
            value={topic}
            onChange={setTopic}
            placeholder={t('placeholder.topic')}
            rows={3}
            disabled={inputDisabled}
          />
        );

      case PodcastInputType.Link:
        return (
          <CustomTextarea
            value={topic}
            onChange={setTopic}
            placeholder={t('placeholder.link')}
            rows={3}
            disabled={inputDisabled}
          />
        );

      case PodcastInputType.FrontPage:
        return (
          <CustomTextarea
            value={topic}
            onChange={setTopic}
            placeholder={t('placeholder.front_page')}
            rows={3}
            disabled={inputDisabled}
          />
        );

      case PodcastInputType.File:
        return (
          <div className="w-full">
            <div
              className="relative rounded-xl border border-dashed border-indigo-300 bg-indigo-50/60 p-6 text-center dark:border-indigo-800 dark:bg-indigo-950/30 sm:p-8"
            >
              {/* 光泽效果 */}
              <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/30 via-transparent to-transparent pointer-events-none"></div>

              <div className="relative z-10">
                <div className="mb-3 sm:mb-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-xl dark:bg-indigo-900 sm:h-14 sm:w-14">
                    📁
                  </div>
                </div>
                <p className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1 sm:mb-2">
                  {t('placeholder.upload_file')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  支持 PDF、TXT、Markdown，最大 4 MB；扫描版 PDF 暂不支持文字识别
                </p>
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.text"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 4_000_000) {
                        toast.error('文件大小须在 4 MB 以内');
                        e.target.value = '';
                        setFile(null);
                      } else setFile(file);
                    }
                  }}
                  id="file-upload"
                  disabled={inputDisabled}
                />
                <label
                  htmlFor="file-upload"
                  className={`mt-4 inline-block cursor-pointer rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-800 ${inputDisabled ? 'pointer-events-none cursor-not-allowed opacity-50' : ''}`}
                >
                  选择文件
                </label>
              </div>
            </div>

            {file && (
              <div
                className="relative mt-3 overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30 sm:p-4"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 relative z-10 font-medium">
                  已选择：{file?.name}
                </p>
                <button
                  type="button"
                  onClick={resetFile}
                  className="absolute top-2 right-2 z-20 text-gray-400 hover:text-red-500 bg-white/70 dark:bg-gray-800/70 rounded-full p-1 shadow transition-colors"
                  title="移除文件"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        );

      case PodcastInputType.LongText:
        return (
          <CustomTextarea
            value={topic}
            onChange={setTopic}
            placeholder={t('placeholder.long_text')}
            rows={4}
            disabled={inputDisabled}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="relative z-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6 lg:p-8"
    >
      {/* 顶部光泽效果 */}
      <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white/30 via-transparent to-transparent pointer-events-none"></div>

      <div className="relative">
        {/* Tab Navigation */}
        <div
          className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-800 sm:flex"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm transition-colors ${activeTab === tab.id
                ? "border-indigo-400 bg-white font-semibold text-indigo-800 shadow-sm dark:bg-indigo-950 dark:text-indigo-200"
                : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"}`}
              disabled={loading}
            >
              {activeTab === tab.id && (
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-lg sm:rounded-xl"></div>
              )}
              <span className="text-sm relative z-10">{tab.icon}</span>
              <span className="font-semibold relative z-10 hidden xs:inline">{tab.label}</span>
              <span className="font-semibold relative z-10 xs:hidden">
                {tab.label}
              </span>
            </button>
          ))}
        </div>

        {/* Input Section */}
        <div className="mb-5 sm:mb-6">
          {renderInputSection()}
        </div>

        {apiWarning && <div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          {apiWarning} <Link href={getLocalePath(locale, '/settings')} className="font-semibold underline">查看 API 配置与授权</Link>
        </div>}

        {/* Bottom Section with Speed Selector and Create Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <TcSelector value={platform} onChange={(v) => {
            setPlatform(v);
            if (v.includes('custom')) {
              setVoiceId_1('');
              setVoiceId_2('');
            }
          }} options={platforms} title={t('platform')} />
          {selectType == SelectType.Select && <TcSelector value={voiceId_1} onChange={setVoiceId_1} options={voiceOptions} title={t('voice_1')} />}
          {selectType == SelectType.Select && <TcSelector value={voiceId_2} onChange={setVoiceId_2} options={voiceOptions} title={t('voice_2')} />}
          {selectType == SelectType.Input && <input type="text" value={voiceId_1} onChange={(e) => setVoiceId_1(e.target.value)} placeholder="Voice id" className="w-full sm:w-32 px-3 sm:px-4 py-2 sm:py-3 text-sm bg-gradient-to-br from-white/90 to-white/60 dark:from-gray-800/90 dark:to-gray-900/60 backdrop-blur-sm border-0 rounded-lg sm:rounded-xl focus:outline-none focus:ring-0 text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none" style={{ boxShadow: 'inset 0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.4)' }} />}
          {selectType == SelectType.Input && <input type="text" value={voiceId_2} onChange={(e) => setVoiceId_2(e.target.value)} placeholder="Voice id" className="w-full sm:w-32 px-3 sm:px-4 py-2 sm:py-3 text-sm bg-gradient-to-br from-white/90 to-white/60 dark:from-gray-800/90 dark:to-gray-900/60 backdrop-blur-sm border-0 rounded-lg sm:rounded-xl focus:outline-none focus:ring-0 text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none" style={{ boxShadow: 'inset 0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.4)' }} />}
          <TcSelector value={outputLanguage} onChange={setOutputLanguage} options={languages[platform as Platform]} title={t('output_language')} />

          {/* Create Button */}
          <button
            onClick={handleSubmit}
            disabled={!readyToSubmit || loading}
            className="relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-indigo-700 px-6 py-3 font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none rounded-lg sm:rounded-xl"></div>
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white dark:text-gray-900 relative z-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                <span className="text-xs sm:text-sm font-bold relative z-10 ml-2">{t('create_button_loading')}</span>
              </>
            ) : (
              <>
                <span className="text-xs sm:text-sm font-bold relative z-10 flex items-center gap-1">
                  {t('create_button')}
                </span>
              </>
            )}
          </button>
        </div>
        {/* platform tips */}
        {platformTips[platform as Platform] && (
          <div className="mt-4 sm:mt-5">
            <a
              href={platformTips[platform as Platform]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm bg-gradient-to-r from-indigo-50/80 to-purple-50/60 dark:from-indigo-900/40 dark:to-purple-900/30 rounded-lg sm:rounded-xl hover:scale-[1.02] transition-all duration-300 text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 relative overflow-hidden"
              style={{
                boxShadow: 'inset 0 2px 10px rgba(99, 102, 241, 0.1), 0 4px 20px rgba(99, 102, 241, 0.05)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent pointer-events-none rounded-lg sm:rounded-xl"></div>
              <span className="relative z-10">🔗</span>
              <span className="relative z-10 font-medium">
                {t('more_voices_about', { platform: platforms.find(p => p.id == platform)?.label })}
              </span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

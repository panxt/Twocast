'use client';

import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';

// 音频轨道接口
interface AudioTrack {
  id: string;
  url: string;
  title: string;
  artist?: string;
  thumbnail?: string;
  duration?: number;
}

// 播放器状态接口
interface AudioPlayerState {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isVisible: boolean;
  playbackRate: number; // 播放速度
}

// 播放器控制接口
interface AudioPlayerControls {
  play: (track: AudioTrack) => Promise<void>;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  hide: () => void;
  show: () => void;
  setPlaybackRate: (rate: number) => void; // 设置播放速度
}

// Context类型
interface AudioPlayerContextType extends AudioPlayerState, AudioPlayerControls {}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

// Provider组件
export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AudioPlayerState>({
    currentTrack: null,
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    isVisible: false,
    playbackRate: 1, // 默认播放速度为1
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const playRequestRef = useRef(0);

  // 播放新音频
  const play = async (track: AudioTrack) => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const request = ++playRequestRef.current;

    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        currentTrack: track,
        isVisible: true,
        // 如果track有duration预设值，先使用它
        duration: track.duration || 0
      }));

      // play() 会自行等待媒体可播放；单独等待 canplay 会在网络或解码失败时一直挂起。
      if (audio.src !== new URL(track.url, window.location.href).href) {
        audio.src = track.url;
      }

      audio.playbackRate = state.playbackRate;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          audio.play(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('音频加载超时')), 15000);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    } catch (error) {
      if (request !== playRequestRef.current) return;
      console.error('播放失败:', error);
      audio.pause();
      toast.error('音频播放失败，请检查网络后重试');
      setState(prev => ({ ...prev, isLoading: false, isPlaying: false }));
    }
  };

  // 暂停播放
  const pause = () => {
    ++playRequestRef.current;
    audioRef.current?.pause();
    setState(prev => ({ ...prev, isLoading: false, isPlaying: false }));
  };

  // 恢复播放
  const resume = async () => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const request = ++playRequestRef.current;
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          audio.play(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('音频加载超时')), 15000);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    } catch (error) {
      if (request !== playRequestRef.current) return;
      console.error('恢复播放失败:', error);
      audio.pause();
      toast.error('音频播放失败，请检查网络后重试');
      setState(prev => ({ ...prev, isLoading: false, isPlaying: false }));
    }
  };

  // 跳转到指定时间
  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setState(prev => ({ ...prev, currentTime: time }));
    }
  };

  // 设置音量
  const setVolume = (volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      setState(prev => ({
        ...prev,
        volume,
        isMuted: volume === 0
      }));
    }
  };

  // 切换静音
  const toggleMute = () => {
    if (!audioRef.current) return;

    setState(prev => {
      const newIsMuted = !prev.isMuted;
      audioRef.current!.volume = newIsMuted ? 0 : prev.volume;
      return { ...prev, isMuted: newIsMuted };
    });
  };

  // 隐藏播放器
  const hide = () => {
    setState(prev => ({ ...prev, isVisible: false }));
  };

  // 显示播放器
  const show = () => {
    setState(prev => ({ ...prev, isVisible: true }));
  };

  // 设置播放速度
  const setPlaybackRate = (rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      setState(prev => ({ ...prev, playbackRate: rate }));
    }
  };

  // 音频事件监听
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      // 优先使用音频元素的实际duration，但保留预设值作为后备
      const actualDuration = audio.duration && !isNaN(audio.duration) ? audio.duration : undefined;
      setState(prev => ({
        ...prev,
        duration: actualDuration || prev.duration || 0
      }));
    };

    const handleTimeUpdate = () => {
      setState(prev => ({ ...prev, currentTime: audio.currentTime }));
    };

    const handlePlay = () => {
      setState(prev => ({ ...prev, isLoading: true }));
    };

    const handlePlaying = () => {
      setState(prev => ({ ...prev, isPlaying: true, isLoading: false }));
    };

    const handleWaiting = () => {
      setState(prev => ({ ...prev, isLoading: true }));
    };

    const handlePause = () => {
      setState(prev => ({ ...prev, isPlaying: false, isLoading: false }));
    };

    const handleEnded = () => {
      setState(prev => ({ ...prev, isPlaying: false, isLoading: false, currentTime: 0 }));
    };

    const handleError = (e: Event) => {
      ++playRequestRef.current;
      const error = (e.target as HTMLAudioElement).error;
      let errorMessage = '音频播放失败';

      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage += ': 网络错误';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage += ': 音频格式不支持';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage += ': 音频源不支持';
            break;
          default:
            errorMessage += ': 未知错误';
        }
      }

      toast.error(errorMessage);
      setState(prev => ({ ...prev, isPlaying: false, isLoading: false }));
    };

    // 监听播放速度变化（外部设置时同步到audio元素）
    audio.playbackRate = state.playbackRate;

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const contextValue: AudioPlayerContextType = {
    ...state,
    play,
    pause,
    resume,
    seek,
    setVolume,
    toggleMute,
    hide,
    show,
    setPlaybackRate, // 暴露设置播放速度方法
  };

  return (
    <AudioPlayerContext.Provider value={contextValue}>
      {children}
      <audio ref={audioRef} preload="metadata" />
    </AudioPlayerContext.Provider>
  );
}

// Hook for using the audio player context
export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}

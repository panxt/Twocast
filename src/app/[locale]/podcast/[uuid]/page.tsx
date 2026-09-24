import { getTaskByUuid } from '@/models/task';
import { taskGetStepItem } from '@/lib/podcast/task';
import { AudioOutput, PodcastStep } from '@/lib/podcast/types';
import { LongTextResult } from '@/queue/types';
import { notFound } from 'next/navigation';
import PodcastPlayer from './components/PodcastPlayer';
import PodcastTabs from './components/PodcastTabs';
import { getCurrentUser } from '@/utils/user';
import { getAudioUrl } from '@/lib/podcast/storage';
import { safeAudioBasename } from '@/lib/podcast/filename';

interface PodcastPageProps {
  params: Promise<{
    uuid: string;
    locale: string;
  }>;
}

export default async function PodcastPage({ params }: PodcastPageProps) {
  const { uuid } = await params
  const user = await getCurrentUser();
  if (!user.userEmail) notFound();
  // 使用 server action 查询 uuid 获取 task
  const task = await getTaskByUuid(uuid);
  
  if (!task || (!user.isAdmin && task.userEmail !== user.userEmail)) {
    notFound();
  }

  // 获取音频详细信息
  const audioItem = taskGetStepItem(task, PodcastStep.Audio);
  
  if (!audioItem.input) {
    notFound();
  }

  const audioData = audioItem.input as LongTextResult;
  const audioOutput = audioItem.output as AudioOutput;
  const audioUrl = await getAudioUrl(audioOutput?.location);
  const downloadUrl = await getAudioUrl(audioOutput?.location, `${safeAudioBasename(audioData.title)}.mp3`)

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900/20">
      {/* 背景装饰光晕 */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-96 h-96 bg-gradient-to-br from-indigo-400/20 to-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-gradient-to-tr from-blue-400/20 to-cyan-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* 页面标题 */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent mb-4">
            {audioData.title}
          </h1>
        </div>

        {/* 播放器区域 */}
        <div className="max-w-4xl mx-auto mb-8 sm:mb-12">
          <PodcastPlayer audioUrl={audioUrl} downloadUrl={downloadUrl} title={audioData.title} duration={audioOutput?.duration}
            lyricsUrl={audioOutput?.timedScript?.length ? `/api/podcast/${uuid}/lyrics` : undefined} />
        </div>

        {/* 内容标签页 */}
        <div className="max-w-4xl mx-auto">
          <PodcastTabs 
            outline={audioData.outline}
            keyPoints={audioData.key_points}
            scripts={audioData.script}
            timedScript={audioOutput?.timedScript}
            audioUrl={audioUrl}
          />
        </div>
      </div>
    </div>
  );
}

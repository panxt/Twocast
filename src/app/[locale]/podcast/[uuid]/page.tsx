import { getTaskByUuid } from '@/models/task';
import { taskGetStepItem } from '@/lib/podcast/task';
import { AudioOutput, PodcastStep } from '@/lib/podcast/types';
import { LongTextResult } from '@/queue/types';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PodcastPlayer from './components/PodcastPlayer';
import PodcastTabs from './components/PodcastTabs';
import { getCurrentUser } from '@/utils/user';
import { canManageTask, canReadTask } from '@/lib/podcast/access';
import { coverUrlFor } from '@/lib/podcast/cover-url';
import { getLocalePath } from '@/utils/locale-util';
import type { LocaleTypes } from '@/i18n/settings';

interface PodcastPageProps {
  params: Promise<{
    uuid: string;
    locale: string;
  }>;
}

export default async function PodcastPage({ params }: PodcastPageProps) {
  const { uuid, locale } = await params
  const user = await getCurrentUser();
  if (!user.userEmail) notFound();
  // 使用 server action 查询 uuid 获取 task
  const task = await getTaskByUuid(uuid);

  if (!task || !canReadTask(task, user)) {
    notFound();
  }

  // 获取音频详细信息
  const audioItem = taskGetStepItem(task, PodcastStep.Audio);

  if (!audioItem.input) {
    notFound();
  }

  const audioData = audioItem.input as LongTextResult;
  const audioOutput = audioItem.output as AudioOutput;
  if (!audioOutput?.location) notFound();
  const audioUrl = `/api/protected/tasks/${encodeURIComponent(uuid)}/audio`;
  const downloadUrl = `${audioUrl}?download=1`;
  const fileName = (task.userInputs as { fileName?: string } | null)?.fileName;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <Link href={getLocalePath(locale as LocaleTypes, '/')} className="inline-flex items-center gap-1.5 self-start text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />返回节目库
      </Link>

      <PodcastPlayer trackId={uuid} audioUrl={audioUrl} downloadUrl={downloadUrl} title={audioData.title} duration={audioOutput?.duration}
        folderPath={task.folderPath} visibility={task.visibility} createdAt={task.createdAt ? new Date(task.createdAt).toISOString() : undefined}
        fileUrl={fileName ? `/api/protected/tasks/${encodeURIComponent(uuid)}/file` : undefined} fileName={fileName}
        coverUrl={coverUrlFor(uuid, task.coverLocation)} canManageCover={canManageTask(task, user)}
        lyricsUrl={audioOutput?.timedScript?.length ? `/api/podcast/${uuid}/lyrics` : undefined}
        bundleUrl={audioOutput?.timedScript?.length && audioOutput.location.startsWith('supabase:') ? `/api/protected/tasks/${encodeURIComponent(uuid)}/bundle` : undefined} />

      <PodcastTabs
        outline={audioData.outline}
        keyPoints={audioData.key_points}
        scripts={audioData.script}
        timedScript={audioOutput?.timedScript}
        trackId={uuid}
      />
    </div>
  );
}

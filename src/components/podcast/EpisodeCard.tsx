'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { Menu, Transition } from '@headlessui/react'
import { Ellipsis, FileText, ImagePlus, LoaderCircle, Lock, Pause, Play, Sparkles, Trash2, Users } from 'lucide-react'
import { TaskVO } from '@/lib/client-api/types/TaskVO'
import { TaskStatus } from '@/types/task'
import { CoverArt } from './CoverArt'
import { useCoverActions } from './CoverActions'

export const titleOf = (task: TaskVO) => task.result?.title || task.user_inputs?.fileName || task.user_inputs?.text?.slice(0, 48) || '未命名节目'
export const progressLabel = (task: TaskVO) => {
  if (task.status === TaskStatus.Pending) return '排队中，等待后台启动'
  if (task.progress?.stage === 'preparing') return '正在整理资料'
  if (task.progress?.stage === 'script') return '正在写脚本'
  if (task.progress?.stage === 'audio') return `正在配音，第 ${task.progress.current || 0} 段，共 ${task.progress.total || '?'} 段`
  if (task.progress?.stage === 'finalizing') return '正在合成音频与字幕'
  return '正在生成'
}
export const progressPercent = (task: TaskVO) => task.progress?.stage === 'audio' && task.progress.total
  ? 100 * Math.min(task.progress.current || 0, task.progress.total) / task.progress.total : null
const folderLabel = (path?: string) => {
  const parts = (path || '/').split('/').filter(Boolean)
  return parts.length ? parts.join(' / ') : ''
}
const dateLabel = (value?: Date | string | null) => {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return `今天 ${date.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, hour: '2-digit', minute: '2-digit' })}`
  }
  return date.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
}

export function EpisodeCard({ task, href, playing, busy, canManage, onPlay, onShare, onOrganize, onDelete, onCoverChanged }: {
  task: TaskVO
  href: string
  playing: boolean
  busy: boolean
  canManage: boolean
  onPlay: () => void
  onShare: () => void
  onOrganize: () => void
  onDelete: () => void
  onCoverChanged: (coverUrl: string | null) => void
}) {
  const running = task.status === TaskStatus.Pending || task.status === TaskStatus.Processing
  const failed = task.status === TaskStatus.Failed
  const ready = task.status === TaskStatus.Success
  const cover = useCoverActions(task.uuid, onCoverChanged)
  const meta = [task.owner_name || '成员', dateLabel(task.created_at), folderLabel(task.folder_path)].filter(Boolean).join(' · ')
  const itemClass = (active: boolean, danger = false) =>
    `flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${active ? 'bg-paper' : ''} ${danger ? 'text-alert' : 'text-ink'} disabled:opacity-40`

  return <li className={`ys-sheet flex flex-col overflow-hidden transition-colors ${playing ? 'border-voice' : ''}`}>
    {ready
      ? <Link href={href} aria-label={`打开 ${titleOf(task)}`} className="block"><CoverArt variant={playing ? 'playing' : 'ready'} coverUrl={task.cover_url} title={titleOf(task)} duration={task.result?.duration} /></Link>
      : <CoverArt variant={running ? 'running' : 'failed'} title={titleOf(task)} progressLabel={progressLabel(task)} progressPercent={progressPercent(task)} error={task.error} />}

    <div className="flex flex-1 flex-col gap-2 p-4">
      {ready
        ? <Link href={href} className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink hover:text-brand">{titleOf(task)}</Link>
        : <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{titleOf(task)}</span>}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
        <span className="truncate">{meta}</span>
        {task.user_inputs?.fileName && <a href={`/api/protected/tasks/${task.uuid}/file`} className="inline-flex max-w-full items-center gap-1 hover:text-brand">
          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{task.user_inputs.fileName}</span></a>}
      </div>
      {(task.labels?.length || 0) > 0 && <div className="flex flex-wrap gap-1">{task.labels?.map(label => <span key={label} className="ys-tag">{label}</span>)}</div>}

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        {ready
          ? <button type="button" onClick={onPlay} aria-label={playing ? `暂停 ${titleOf(task)}` : `播放 ${titleOf(task)}`}
              className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${playing ? 'bg-voice text-brand-on' : 'border border-rule bg-sheet text-brand hover:border-brand hover:bg-brand-tint'}`}>
              {playing ? <Pause className="h-4 w-4" fill="currentColor" aria-hidden="true" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true" />}
            </button>
          : <span />}
        <div className="flex items-center gap-2">
          {ready && (task.visibility === 'team'
            ? <span className="ys-pill bg-voice-tint text-voice-deep"><Users className="h-3 w-3" aria-hidden="true" />团队共享</span>
            : <span className="ys-pill bg-paper text-ink-soft"><Lock className="h-3 w-3" aria-hidden="true" />仅自己</span>)}
          {canManage && <Menu as="div" className="relative">
            {cover.fileInput}{cover.promptDialog}
            <Menu.Button aria-label={`${titleOf(task)} 的更多操作`} disabled={busy || cover.busy !== null} className="ys-icon-btn h-8 w-8 rounded-lg border border-rule bg-sheet">
              {busy || cover.busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Ellipsis className="h-4 w-4" aria-hidden="true" />}
            </Menu.Button>
            <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="opacity-0 -translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-75" leaveFrom="opacity-100" leaveTo="opacity-0">
              <Menu.Items className="ys-sheet absolute bottom-full right-0 z-40 mb-1.5 w-48 origin-bottom-right p-1 shadow-bar focus:outline-none">
                <Menu.Item disabled={!ready && task.visibility !== 'team'}>
                  {({ active }) => <button type="button" onClick={onShare} className={itemClass(active)}>{task.visibility === 'team' ? '设为仅自己可见' : '共享给团队'}</button>}
                </Menu.Item>
                <Menu.Item>{({ active }) => <button type="button" onClick={onOrganize} className={itemClass(active)}>归档与标签</button>}</Menu.Item>
                {ready && <>
                  <div className="my-1 border-t border-rule" />
                  <Menu.Item>{({ active }) => <button type="button" onClick={cover.pickFile} className={itemClass(active)}><ImagePlus className="h-4 w-4" aria-hidden="true" />{task.cover_url ? '更换封面' : '上传封面'}</button>}</Menu.Item>
                  <Menu.Item>{({ active }) => <button type="button" onClick={cover.openGenerate} className={itemClass(active)}><Sparkles className="h-4 w-4" aria-hidden="true" />AI 生成封面</button>}</Menu.Item>
                  {task.cover_url && <Menu.Item>{({ active }) => <button type="button" onClick={cover.remove} className={itemClass(active)}><Trash2 className="h-4 w-4" aria-hidden="true" />移除封面</button>}</Menu.Item>}
                </>}
                <div className="my-1 border-t border-rule" />
                <Menu.Item disabled={running}>{({ active }) => <button type="button" onClick={onDelete} className={itemClass(active, true)}><Trash2 className="h-4 w-4" aria-hidden="true" />删除节目</button>}</Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>}
        </div>
      </div>
    </div>
  </li>
}

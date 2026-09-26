'use client'

import { Fragment, useRef, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { toast } from 'sonner'
import { ImagePlus, LoaderCircle, Sparkles, Trash2, X } from 'lucide-react'

// 封面的三个动作：上传、AI 生成、移除。以 hook 形式暴露，卡片菜单和详情页共用同一套请求逻辑。
export function useCoverActions(uuid: string, onChanged: (coverUrl: string | null) => void) {
  const [busy, setBusy] = useState<'upload' | 'generate' | 'remove' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [promptOpen, setPromptOpen] = useState(false)

  async function upload(file: File | undefined) {
    if (!file) return
    if (file.size > 3_000_000) { toast.error('图片须在 3 MB 以内'); return }
    setBusy('upload')
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await fetch(`/api/protected/tasks/${uuid}/cover`, { method: 'POST', body: form })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '上传失败')
      onChanged(body.coverUrl)
      toast.success('封面已更新')
    } catch (error) { toast.error(error instanceof Error ? error.message : '上传失败') }
    finally { setBusy(null); if (fileRef.current) fileRef.current.value = '' }
  }

  async function generate(hint: string) {
    setBusy('generate')
    try {
      const response = await fetch(`/api/protected/tasks/${uuid}/cover/generate`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hint }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '生成失败')
      onChanged(body.coverUrl)
      toast.success('AI 封面已生成')
      setPromptOpen(false)
    } catch (error) { toast.error(error instanceof Error ? error.message : '生成失败') }
    finally { setBusy(null) }
  }

  async function remove() {
    setBusy('remove')
    try {
      const response = await fetch(`/api/protected/tasks/${uuid}/cover`, { method: 'DELETE' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '移除失败')
      onChanged(null)
      toast.success('已移除封面')
    } catch (error) { toast.error(error instanceof Error ? error.message : '移除失败') }
    finally { setBusy(null) }
  }

  const fileInput = <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="上传封面"
    onChange={event => upload(event.target.files?.[0])} />
  const promptDialog = <CoverPromptDialog open={promptOpen} busy={busy === 'generate'} onClose={() => setPromptOpen(false)} onSubmit={generate} />

  return { busy, fileInput, promptDialog, pickFile: () => fileRef.current?.click(), openGenerate: () => setPromptOpen(true), remove }
}

function CoverPromptDialog({ open, busy, onClose, onSubmit }: { open: boolean; busy: boolean; onClose: () => void; onSubmit: (hint: string) => void }) {
  const [hint, setHint] = useState('')
  return <Transition show={open} as={Fragment}>
    <Dialog onClose={() => { if (!busy) onClose() }} className="relative z-50">
      <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
        <div className="fixed inset-0 bg-ink/40" aria-hidden="true" />
      </Transition.Child>
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 translate-y-2" enterTo="opacity-100 translate-y-0" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <Dialog.Panel className="ys-sheet w-full max-w-md p-6 shadow-bar">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="ys-title text-xl">AI 生成封面</Dialog.Title>
                <p className="mt-1 text-sm text-ink-soft">会根据节目标题和大纲作画，生成一张无文字的方形插画。可以补一句想要的画面。</p>
              </div>
              <button type="button" onClick={onClose} disabled={busy} aria-label="关闭" className="ys-icon-btn h-9 w-9"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <label className="mt-4 flex flex-col gap-2">
              <span className="text-sm font-semibold">画面提示（可选）</span>
              <textarea value={hint} onChange={event => setHint(event.target.value)} rows={3} maxLength={200}
                placeholder="例如：海运集装箱与数据曲线，青绿色调" className="ys-field min-h-[88px] resize-none py-2.5" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={busy} className="ys-btn ys-btn-secondary">取消</button>
              <button type="button" onClick={() => onSubmit(hint.trim())} disabled={busy} className="ys-btn ys-btn-primary">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                {busy ? '正在作画，约 10 秒' : '生成封面'}
              </button>
            </div>
          </Dialog.Panel>
        </Transition.Child>
      </div>
    </Dialog>
  </Transition>
}

// 三个按钮的并排版本（详情页用）；菜单版本在卡片里直接用 hook 拼。
export function CoverActionButtons({ uuid, hasCover, canGenerate, onChanged }: { uuid: string; hasCover: boolean; canGenerate: boolean; onChanged: (coverUrl: string | null) => void }) {
  const actions = useCoverActions(uuid, onChanged)
  return <div className="flex flex-wrap items-center gap-2">
    {actions.fileInput}{actions.promptDialog}
    <button type="button" onClick={actions.pickFile} disabled={actions.busy !== null} className="ys-btn ys-btn-secondary min-h-10 px-3.5">
      {actions.busy === 'upload' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}{hasCover ? '换封面' : '上传封面'}
    </button>
    {canGenerate && <button type="button" onClick={actions.openGenerate} disabled={actions.busy !== null} className="ys-btn ys-btn-secondary min-h-10 px-3.5">
      <Sparkles className="h-4 w-4" aria-hidden="true" />AI 生成
    </button>}
    {hasCover && <button type="button" onClick={actions.remove} disabled={actions.busy !== null} className="ys-btn ys-btn-quiet min-h-10 px-3">
      {actions.busy === 'remove' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}移除
    </button>}
  </div>
}

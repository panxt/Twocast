'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X } from 'lucide-react'
import { UserInput } from './UserInput'

type FolderOption = { path: string; label: string; depth: number; episodes: number }

// 新建节目抽屉：从右侧滑出，卡片墙留在身后。创建成功后关闭并刷新列表。
export function NewEpisodeDrawer({ open, defaultFolder, onClose, onCreated }: {
  open: boolean; defaultFolder: string; onClose: () => void; onCreated: () => void
}) {
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [folderPath, setFolderPath] = useState(defaultFolder || '/')

  useEffect(() => { setFolderPath(defaultFolder || '/') }, [defaultFolder, open])
  useEffect(() => {
    if (!open) return
    fetch('/api/protected/folders', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : { folders: [] }).then(body => setFolders(body.folders || [])).catch(() => undefined)
  }, [open])

  return <Transition show={open} as={Fragment}>
    <Dialog onClose={onClose} className="relative z-50">
      <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
        <div className="fixed inset-0 bg-ink/35" aria-hidden="true" />
      </Transition.Child>
      <div className="fixed inset-y-0 right-0 flex max-w-full">
        <Transition.Child as={Fragment} enter="transform transition ease-out duration-200" enterFrom="translate-x-full" enterTo="translate-x-0" leave="transform transition ease-in duration-150" leaveFrom="translate-x-0" leaveTo="translate-x-full">
          <Dialog.Panel className="flex h-full w-screen max-w-[520px] flex-col overflow-y-auto border-l border-rule bg-sheet shadow-bar">
            <div className="flex items-start justify-between gap-3 px-6 pt-6 sm:px-8">
              <div className="flex flex-col gap-1">
                <Dialog.Title className="ys-title text-2xl">新建节目</Dialog.Title>
                <p className="text-sm text-ink-soft">给一段资料，得到一期两位主持人对谈的播客。</p>
              </div>
              <button type="button" onClick={onClose} aria-label="关闭" className="ys-icon-btn h-9 w-9"><X className="h-[18px] w-[18px]" aria-hidden="true" /></button>
            </div>
            <div className="flex flex-col gap-5 px-6 py-6 sm:px-8">
              <UserInput folderPath={folderPath} onSubmitSuccess={onCreated}
                extraFields={<label className="flex flex-col gap-1.5">
                  <span className="ys-label">归档到</span>
                  <input list="new-episode-folders" value={folderPath} onChange={event => setFolderPath(event.target.value)} placeholder="/ 表示不归档" className="ys-field" />
                  <datalist id="new-episode-folders"><option value="/" />{folders.map(item => <option key={item.path} value={item.path} />)}</datalist>
                </label>} />
            </div>
          </Dialog.Panel>
        </Transition.Child>
      </div>
    </Dialog>
  </Transition>
}

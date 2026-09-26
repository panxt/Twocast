'use client'

import { useState } from 'react'
import { ListPanel } from './ListPanel'
import { UserInput } from './UserInput'
import type { EpisodeListData } from '@/lib/podcast/list'

// 工作台：左手"新建节目"，右手"节目库"。像写信与信箱并排——写完一封，右边立刻能看到它在路上。
export function UserPanel({ initialList }: { initialList: EpisodeListData }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  return <div className="mx-auto grid max-w-7xl items-start gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:px-10 lg:py-8">
    <section aria-label="新建节目" className="ys-sheet flex flex-col gap-5 p-5 sm:p-7 lg:sticky lg:top-24">
      <div className="flex flex-col gap-1.5">
        <h1 className="ys-title text-2xl sm:text-[28px]">新建节目</h1>
        <p className="text-sm text-ink-soft">给一段资料，得到一期两位主持人对谈的播客。</p>
      </div>
      <UserInput onSubmitSuccess={() => {
        setRefreshTrigger(value => value + 1)
        document.getElementById('episode-library')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }} />
    </section>
    <ListPanel refreshTrigger={refreshTrigger} apiUrl="/api/protected/get-list" initialList={initialList} />
  </div>
}

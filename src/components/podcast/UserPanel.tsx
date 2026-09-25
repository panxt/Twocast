'use client'

import { useState } from 'react'
import { ListPanel } from './ListPanel'
import { UserInput } from './UserInput'
import type { EpisodeListData } from '@/lib/podcast/list'

export function UserPanel({ initialList }: { initialList: EpisodeListData }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  return <main className="min-h-[70vh] bg-gray-50 px-4 py-8 dark:bg-gray-950 sm:py-12">
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="mb-2 text-xs font-semibold tracking-[0.24em] text-indigo-600 dark:text-indigo-300">驿·声笺</p>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-950 dark:text-white">团队播客工作台</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">把团队资料变成可收听、可整理、可分享的节目。</p>
      </header>
      <section aria-label="创建播客">
        <h2 className="mb-4 text-lg font-semibold">新建节目</h2>
        <UserInput onSubmitSuccess={() => {
          setRefreshTrigger(value => value + 1)
          document.getElementById('episode-library')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }} />
      </section>
      <ListPanel refreshTrigger={refreshTrigger} apiUrl="/api/protected/get-list" initialList={initialList} />
    </div>
  </main>
}

'use client'

import { useState } from 'react'
import { ListPanel } from './ListPanel'
import { UserInput } from './UserInput'

export function UserPanel() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  return <main className="min-h-[70vh] bg-gray-50 px-4 py-8 dark:bg-gray-950 sm:py-12">
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-950 dark:text-white">播客工作台</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">把资料变成可收听、可整理的节目。</p>
      </header>
      <section aria-label="创建播客">
        <h2 className="mb-4 text-lg font-semibold">新建节目</h2>
        <UserInput onSubmitSuccess={() => setRefreshTrigger(value => value + 1)} />
      </section>
      <ListPanel refreshTrigger={refreshTrigger} apiUrl="/api/protected/get-list" />
    </div>
  </main>
}

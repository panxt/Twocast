'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WechatBrowserImport } from './WechatBrowserImport'
import { UserInput } from './UserInput'
import type { WechatImport } from '@/lib/podcast/wechat-import'

export function WechatImportDemo() {
  const [article, setArticle] = useState<WechatImport | null>(null)
  const router = useRouter()
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm font-medium text-brand" role="status">
        {article ? '第 2 步：配置并生成播客' : '第 1 步：导入并核对正文'}
      </p>
      {!article && <WechatBrowserImport disabled={false} onImport={setArticle} />}
      {article && (
        <section className="flex flex-col gap-5 rounded-control border border-rule bg-sheet p-4">
          <div>
            <h2 className="font-semibold">{article.title}</h2>
            <p className="my-2 text-sm text-ink-soft">
              完整正文已自动带入，无需再次复制或新建节目。选择语言、配音及额度后，点击创建播客。
            </p>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm text-brand underline"
            >
              原地址
            </a>
          </div>
          <UserInput
            initialText={article.text}
            showBrowserImport={false}
            onSubmitSuccess={() => {
              router.push('/')
              router.refresh()
            }}
          />
        </section>
      )}
    </div>
  )
}

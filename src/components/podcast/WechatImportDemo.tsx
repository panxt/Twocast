'use client'

import { useState } from 'react'
import { WechatBrowserImport } from './WechatBrowserImport'
import type { WechatImport } from '@/lib/podcast/wechat-import'

export function WechatImportDemo() {
  const [article, setArticle] = useState<WechatImport | null>(null)
  const [message, setMessage] = useState('')
  return (
    <div className="flex flex-col gap-5">
      <WechatBrowserImport disabled={false} onImport={setArticle} />
      {article && (
        <section className="rounded-control border border-rule bg-sheet p-4">
          <h2 className="font-semibold">已整理的完整资料</h2>
          <p className="my-2 text-sm text-ink-soft">
            此试用页只预览，不创建节目。复制后进入节目库的新建节目，粘贴到长文本即可；原地址会随正文保留。
          </p>
          <textarea
            aria-label="整理后的完整资料"
            readOnly
            value={article.text}
            className="ys-field h-64 w-full"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            className="ys-btn ys-btn-primary mt-3"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(article.text)
                setMessage('已复制，请在新建节目的长文本中粘贴。')
              } catch {
                setMessage('请选中上面的全文手动复制。')
              }
            }}
          >
            复制完整资料
          </button>
          {message && (
            <p role="status" className="mt-2 text-sm">
              {message}
            </p>
          )}
        </section>
      )}
    </div>
  )
}

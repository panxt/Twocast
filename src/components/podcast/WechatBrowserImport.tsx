'use client'

import { useEffect, useRef, useState } from 'react'
import {
  parseWechatImport,
  WECHAT_BOOKMARKLET,
  type WechatImport,
} from '@/lib/podcast/wechat-import'

export function WechatBrowserImport({
  disabled,
  onImport,
}: {
  disabled: boolean
  onImport: (article: WechatImport) => void
}) {
  const link = useRef<HTMLAnchorElement>(null)
  const [raw, setRaw] = useState('')
  const [preview, setPreview] = useState<WechatImport | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    // React sanitizes javascript href props; set only this audited constant.
    link.current?.setAttribute('href', WECHAT_BOOKMARKLET)
  }, [])
  function review(value: string) {
    setPreview(null)
    setMessage('')
    try {
      setPreview(parseWechatImport(value))
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '导入失败')
    }
  }
  async function paste() {
    setBusy(true)
    try {
      const value = await navigator.clipboard.readText()
      setRaw(value)
      review(value)
    } catch {
      setMessage('浏览器未允许读取剪贴板，请在下面手动粘贴，再点“预览正文”。')
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="bg-canvas rounded-control border border-rule p-3 text-sm">
      <summary className="cursor-pointer font-semibold">公众号浏览器导入 · 无需安装扩展</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="leading-6 text-ink-soft">
          ① 将下面的「导入到声笺」拖到 Chrome 书签栏。② 在 Chrome
          打开公众号文章，完成访问验证后点击书签。③ 回到这里粘贴并预览。预览不会创建节目或占用额度。
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            ref={link}
            href="#"
            draggable
            className="ys-btn ys-btn-secondary"
            onClick={(e) => {
              e.preventDefault()
              setMessage('请把这个按钮拖到书签栏，在公众号文章页面点击；不要在本站执行。')
            }}
          >
            导入到声笺（拖到书签栏）
          </a>
          <button
            type="button"
            className="ys-btn ys-btn-secondary"
            disabled={disabled || busy}
            onClick={paste}
          >
            {busy ? '正在读取…' : '粘贴并预览'}
          </button>
        </div>
        <details>
          <summary className="cursor-pointer text-ink-soft">无法拖动？手动安装书签</summary>
          <p className="my-2">
            新建书签，名称填「导入到声笺」，网址替换为下面完整代码。仅复制当前文章正文，不读取
            Cookie，不向外发送数据。
          </p>
          <textarea
            readOnly
            aria-label="书签安装代码"
            value={WECHAT_BOOKMARKLET}
            className="ys-field h-24 w-full font-mono text-xs"
            onFocus={(e) => e.target.select()}
          />
        </details>
        <textarea
          aria-label="粘贴公众号导入内容"
          placeholder="也可以在此手动粘贴书签复制的内容"
          className="ys-field h-24 w-full"
          value={raw}
          disabled={disabled || busy}
          onChange={(e) => {
            setRaw(e.target.value)
            setPreview(null)
            setMessage('')
          }}
        />
        <button
          type="button"
          className="ys-btn ys-btn-secondary self-start"
          disabled={disabled || busy || !raw.trim()}
          onClick={() => review(raw)}
        >
          预览正文
        </button>
        {message && (
          <p role="status" className="text-alert-deep">
            {message}
          </p>
        )}
        {preview && (
          <div className="rounded-control border border-rule bg-sheet p-3">
            <p className="font-semibold">{preview.title}</p>
            <p className="my-1 text-ink-soft">
              {preview.author || '公众号'} · 正文 {preview.content.length.toLocaleString()} 字符
            </p>
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-brand underline"
            >
              查看原地址
            </a>
            <pre className="my-3 max-h-48 overflow-auto whitespace-pre-wrap font-sans">
              {preview.content}
            </pre>
            <button
              type="button"
              disabled={disabled}
              className="ys-btn ys-btn-primary"
              onClick={() => {
                onImport(preview)
                setRaw('')
                setPreview(null)
                setMessage('全文和原地址已带入播客配置，请选择语言与配音，再创建播客。')
              }}
            >
              确认正文，进入播客配置
            </button>
          </div>
        )}
        <p className="text-xs leading-5 text-ink-soft">
          适合电脑 Chrome。图片里的文字不会自动识别；页面禁止书签执行时，可复制正文或上传 TXT /
          Markdown。超过 10 万字符会提示拆分，不自动截断。
        </p>
      </div>
    </details>
  )
}

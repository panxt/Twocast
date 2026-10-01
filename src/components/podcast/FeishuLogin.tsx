'use client'
import { useEffect, useState } from 'react'
export default function FeishuLogin({ bind = false }: { bind?: boolean }) {
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    fetch('/api/auth/feishu?status=1')
      .then((r) => r.json())
      .then((d) => {
        if (alive) setEnabled(d.enabled)
      })
      .catch(() => undefined)
    const reason = new URLSearchParams(window.location.search).get('error')
    if (reason?.startsWith('feishu'))
      setError(
        reason === 'feishu_unbound'
          ? '此飞书账号尚未绑定，请先使用邀请码登录，再到设置绑定。'
          : reason === 'feishu_disabled'
            ? '账号已停用，请联系管理员。'
            : '飞书授权未完成，请重试或使用个人登录码。'
      )
    return () => {
      alive = false
    }
  }, [])
  return (
    <div className="space-y-2 text-sm">
      <a
        className={`ys-btn-sm ys-btn-secondary ${!enabled ? 'pointer-events-none opacity-50' : ''}`}
        aria-disabled={!enabled}
        href={`/api/auth/feishu${bind ? '?mode=bind' : ''}`}
      >
        {bind ? '绑定飞书账号' : '使用飞书登录'}
      </a>
      <p className="text-xs text-ink-soft">
        {enabled
          ? '先通过邀请码加入并绑定飞书，之后可直接使用飞书登录。'
          : '飞书登录待管理员配置应用。邀请码和个人登录码可正常使用。'}
      </p>
      {error && (
        <p role="alert" className="text-alert-deep">
          {error}
        </p>
      )}
    </div>
  )
}

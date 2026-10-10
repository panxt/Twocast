'use client'
import { useEffect, useState } from 'react'

export default function TranscriptFallbackPanel() {
  const [key, setKey] = useState('')
  const [configured, setConfigured] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let alive = true
    fetch('/api/admin/settings')
      .then(async (r) => {
        if (!r.ok) throw new Error('字幕兜底配置加载失败')
        const data = await r.json()
        if (!alive) return
        setConfigured(data.settings?.SUPADATA_API_KEY === true)
        setEnabled(data.settings?.SUPADATA_ENABLED === '1')
        setReady(true)
      })
      .catch(() => {
        if (alive) setMessage('字幕兜底配置加载失败，请刷新重试')
      })
    return () => {
      alive = false
    }
  }, [])
  return (
    <section className="ys-sheet space-y-4 p-5 sm:p-6">
      <h2 className="ys-title text-lg">YouTube 字幕兜底</h2>
      <p className="text-sm text-ink-soft">
        优先免费提取，失败后才使用
        Supadata。启用后适用于所有已登录成员，仅获取现有字幕，不自动做语音转录。此额度独立于
        MiniMax、聊天模型和平台生成次数；来源读取失败不会创建节目。
      </p>
      <p className="text-sm text-ink-soft">
        在{' '}
        <a className="underline" href="https://dash.supadata.ai/" target="_blank" rel="noreferrer">
          Supadata 控制台
        </a>
        注册并取得 Key 后填写。免费套餐额度及余额请查看{' '}
        <a
          className="underline"
          href="https://supadata.ai/pricing"
          target="_blank"
          rel="noreferrer"
        >
          官方说明
        </a>
        。只会把视频链接发送给该服务。
      </p>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!ready || busy) return
          if (enabled && !configured && !key.trim()) {
            setMessage('启用前请填写 Supadata API Key')
            return
          }
          setBusy(true)
          setMessage('')
          try {
            const r = await fetch('/api/admin/settings', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                SUPADATA_API_KEY: key,
                SUPADATA_ENABLED: enabled ? '1' : '0',
              }),
            })
            if (!r.ok) throw new Error('保存失败，请确认超级管理员权限后重试')
            if (key.trim()) setConfigured(true)
            setKey('')
            setMessage('已保存，立即生效')
          } catch (error) {
            setMessage(error instanceof Error ? error.message : '保存失败')
          } finally {
            setBusy(false)
          }
        }}
      >
        <label className="block text-sm">
          Supadata API Key
          <input
            className="ys-field"
            type="password"
            autoComplete="off"
            maxLength={2048}
            disabled={!ready || busy}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={configured ? '已配置，留空保留' : '填写 Supadata API Key'}
          />
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!ready || busy}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          启用失败后的第三方字幕兜底（保存后生效）
        </label>
        <button className="ys-btn ys-btn-primary" disabled={!ready || busy}>
          {busy ? '保存中…' : '保存字幕配置'}
        </button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </form>
    </section>
  )
}

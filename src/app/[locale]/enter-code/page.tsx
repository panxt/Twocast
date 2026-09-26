'use client'

import { FormEvent, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { RouteMark } from '@/components/RouteMark'

export default function EnterCode() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loginCode, setLoginCode] = useState('')

  async function redeem(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth/redeem', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '兑换失败')
      }
      const data = await response.json()
      if (data.loginCode) setLoginCode(data.loginCode)
      else window.location.href = '/'
    } catch (error) {
      setError(error instanceof Error ? error.message : '兑换失败')
    } finally {
      setLoading(false)
    }
  }

  return <main className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:min-h-[calc(100vh-8rem)] lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-8">
    <section className="flex flex-col gap-6 lg:pl-10">
      <RouteMark className="w-full max-w-md" />
      <h1 className="ys-title max-w-[12em] text-3xl leading-tight sm:text-4xl lg:text-[44px]">把团队资料，寄成一期能听的节目。</h1>
      <p className="max-w-[30em] text-base text-ink-soft">粘一段主题、一个链接或一份 PDF，两位主持人替你讲清楚；节目按目录归档，整个团队都能找到。</p>
    </section>

    <div className="w-full max-w-md justify-self-center">
      {loginCode ? <section aria-live="polite" className="ys-sheet flex flex-col gap-4 p-7 sm:p-9">
        <h2 className="ys-title text-2xl">请保存你的个人登录码</h2>
        <p className="text-sm text-ink-soft">邀请码只供首次加入；下次换设备或会话过期时，用这个登录码回到自己的账户。请勿分享给他人。</p>
        <output className="ys-code text-base tracking-wider">{loginCode}</output>
        <button type="button" onClick={() => window.location.href = '/'} className="ys-btn ys-btn-primary">已保存，进入工作台</button>
      </section> : <form onSubmit={redeem} className="ys-sheet flex flex-col gap-5 p-7 sm:p-9">
        <div className="flex flex-col gap-1.5">
          <h2 className="ys-title text-2xl">进入工作台</h2>
          <p className="text-sm text-ink-soft">用团队邀请码首次加入，或用个人登录码回到自己的账户。</p>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">邀请码或登录码</span>
          <input value={code} onChange={event => setCode(event.target.value)} autoComplete="off"
            placeholder="粘贴邀请码或登录码" className="ys-field h-12 text-base tracking-wider" />
        </label>
        {error && <p role="alert" className="ys-note flex items-start gap-2 bg-alert-tint text-alert-deep">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>}
        <button disabled={loading || !code.trim()} className="ys-btn ys-btn-primary h-12 text-[15px]">
          {loading ? '正在验证…' : '进入工作台'}
        </button>
        <p className="text-xs text-ink-soft">邀请码只用于首次加入；成功后会给你一个个人登录码，请妥善保存。</p>
      </form>}
    </div>
  </main>
}

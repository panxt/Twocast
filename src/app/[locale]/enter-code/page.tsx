'use client'

import { FormEvent, useState } from 'react'

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

  return <main className="mx-auto max-w-md px-6 py-24 text-center">
    <h1 className="text-3xl font-bold">进入播客工作台</h1>
    <p className="mt-4 text-gray-600">输入邀请码或个人登录码。</p>
    {loginCode && <section className="mt-8 rounded-xl border p-5 text-left">
      <h2 className="font-semibold">请保存你的个人登录码</h2>
      <p className="mt-2 text-sm">邀请码只供首次加入；下次换设备或会话过期时使用此码。请勿分享。</p>
      <output className="mt-3 block break-all rounded bg-gray-100 p-3 font-mono text-sm dark:bg-gray-800">{loginCode}</output>
      <button onClick={() => window.location.href = '/'} className="mt-4 rounded bg-indigo-600 px-4 py-2 text-white">已保存，继续</button>
    </section>}
    <form onSubmit={redeem} className="mt-8 flex flex-col gap-4">
      <input aria-label="邀请码" value={code} onChange={event => setCode(event.target.value)}
        autoComplete="off" placeholder="邀请码" className="rounded-xl border px-4 py-3 text-center dark:bg-gray-800" />
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <button disabled={loading || !code.trim()} className="rounded-xl bg-indigo-600 px-4 py-3 text-white disabled:opacity-50">
        {loading ? '验证中…' : '进入工作台'}
      </button>
    </form>
  </main>
}

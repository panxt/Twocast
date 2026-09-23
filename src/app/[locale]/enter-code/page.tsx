'use client'

import { FormEvent, useState } from 'react'

export default function EnterCode() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      window.location.href = '/'
    } catch (error) {
      setError(error instanceof Error ? error.message : '兑换失败')
    } finally {
      setLoading(false)
    }
  }

  return <main className="mx-auto max-w-md px-6 py-24 text-center">
    <h1 className="text-3xl font-bold">Twocast 内测</h1>
    <p className="mt-4 text-gray-600">输入邀请码后即可生成和收听播客。</p>
    <form onSubmit={redeem} className="mt-8 flex flex-col gap-4">
      <input aria-label="邀请码" value={code} onChange={event => setCode(event.target.value)}
        autoComplete="off" placeholder="邀请码" className="rounded-xl border px-4 py-3 text-center dark:bg-gray-800" />
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <button disabled={loading || !code.trim()} className="rounded-xl bg-indigo-600 px-4 py-3 text-white disabled:opacity-50">
        {loading ? '验证中…' : '进入 Twocast'}
      </button>
    </form>
  </main>
}

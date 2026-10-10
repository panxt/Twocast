import Link from 'next/link'
import { WechatImportDemo } from '@/components/podcast/WechatImportDemo'

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="ys-title text-3xl">公众号浏览器导入</h1>
      <p className="mb-6 mt-3 text-ink-soft">
        无需扩展或 API Key。先在 Chrome
        打开原文，再用书签提取。这个页面可安装工具、预览全文，不会消耗生成额度。
      </p>
      <WechatImportDemo />
      <Link href={`/${locale}`} className="mt-6 inline-block text-brand underline">
        返回节目库
      </Link>
    </main>
  )
}

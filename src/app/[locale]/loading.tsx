export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8" role="status" aria-label="正在加载页面">
      <p className="text-sm text-ink-soft">正在加载内容…</p>
      <div className="h-10 w-48 animate-pulse rounded bg-rule" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {[1, 2, 3].map((key) => (
          <div key={key} className="rounded-card bg-rule/50 h-56 animate-pulse" />
        ))}
      </div>
    </div>
  )
}

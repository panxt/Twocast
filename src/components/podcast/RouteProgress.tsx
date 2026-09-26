'use client'

// 驿路进度：一条从"资料"到"节目"的路线，行进中的圆点就是这期节目走到哪了。
// percent 为 null 表示阶段未知比例（整理素材 / 生成脚本），圆点来回巡航而不是停在 0。
export function RouteProgress({ percent, label }: { percent: number | null; label: string }) {
  const known = percent !== null
  const clamped = known ? Math.max(0, Math.min(100, percent)) : 0
  return <svg viewBox="0 0 600 18" preserveAspectRatio="none" className="block h-[18px] w-full"
    role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={known ? Math.round(clamped) : undefined}>
    <line x1="9" y1="9" x2="591" y2="9" stroke="var(--ys-voice-tint)" strokeWidth="3" strokeLinecap="round" />
    {known && <line x1="9" y1="9" x2={9 + 582 * clamped / 100} y2="9" stroke="var(--ys-voice)" strokeWidth="3" strokeLinecap="round" />}
    <circle cx="9" cy="9" r="5" fill="var(--ys-voice)" />
    <circle cx="591" cy="9" r="5" fill="var(--ys-sheet)" stroke="var(--ys-voice-rail)" strokeWidth="2" />
    {known
      ? <circle cx={9 + 582 * clamped / 100} cy="9" r="6" fill="var(--ys-sheet)" stroke="var(--ys-voice)" strokeWidth="3" className="transition-[cx] duration-500" />
      : <circle cy="9" r="6" fill="var(--ys-sheet)" stroke="var(--ys-voice)" strokeWidth="3">
          <animate attributeName="cx" values="9;591;9" dur="3.2s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
        </circle>}
  </svg>
}

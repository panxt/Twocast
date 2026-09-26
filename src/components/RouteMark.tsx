// 驿路：品牌标记里的那条"资料 → 节目"路线，放大用作进入页的主视觉。
export function RouteMark({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 440 150" role="img" aria-label="资料经由驿·声笺变成节目" className={className}>
    <path d="M20 110 C 120 110, 120 30, 220 30 S 320 110, 420 110" fill="none" stroke="var(--ys-voice)" strokeWidth="5" strokeLinecap="round" />
    <circle cx="20" cy="110" r="9" fill="var(--ys-paper)" stroke="var(--ys-brand)" strokeWidth="5" />
    <circle cx="420" cy="110" r="9" fill="var(--ys-paper)" stroke="var(--ys-voice)" strokeWidth="5" />
    <path d="M204 102v28M220 96v40M236 102v28" stroke="var(--ys-brand)" strokeWidth="5" strokeLinecap="round" />
    <text x="4" y="146" fontSize="13" fill="var(--ys-ink-soft)">资料</text>
    <text x="392" y="146" fontSize="13" fill="var(--ys-ink-soft)">节目</text>
  </svg>
}

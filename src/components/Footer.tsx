'use client'

export default function Footer() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-xs text-ink-soft sm:px-6 lg:px-10">
        <span>驿·声笺 {new Date().getFullYear()}</span>
        <a
          href="https://github.com/panyanyany/Twocast"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:text-brand hover:underline"
          aria-label="查看 ToCast 原项目"
        >
          基于 ToCast
        </a>
      </div>
    </footer>
  )
}

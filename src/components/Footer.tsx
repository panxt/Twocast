'use client'

export default function Footer() {
  return <footer className="border-t border-rule">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-xs text-ink-soft sm:px-6 lg:px-10">
      <span>驿·声笺 {new Date().getFullYear()}</span>
      <span>基于 ToCast</span>
    </div>
  </footer>
}

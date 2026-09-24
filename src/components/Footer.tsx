'use client'

export default function Footer() {
  return <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
    ToCast · {new Date().getFullYear()}
  </footer>
}

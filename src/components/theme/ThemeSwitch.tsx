'use client'

import * as React from 'react'
import { Fragment } from 'react'
import { createPortal } from 'react-dom'
import { Menu, Transition } from '@headlessui/react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeContext'

const options = [
  { id: 'light', label: '浅色', Icon: Sun },
  { id: 'dark', label: '深色', Icon: Moon },
  { id: 'system', label: '跟随系统', Icon: Monitor },
] as const

// compact：侧栏底部的小号无边框版本；菜单向上弹出。
const ThemeSwitch = ({ compact = false }: { compact?: boolean }) => {
  const { theme, setTheme, mounted } = useTheme()
  const [systemDark, setSystemDark] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const [position, setPosition] = React.useState<React.CSSProperties>({})
  const updatePosition = React.useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const left = Math.max(
      8,
      Math.min(compact ? rect.left : rect.right - 144, window.innerWidth - 152)
    )
    setPosition(
      compact
        ? { left, bottom: Math.max(8, window.innerHeight - rect.top + 8) }
        : { left, top: rect.bottom + 8 }
    )
  }, [compact])

  React.useEffect(() => {
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [updatePosition])

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => setSystemDark(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const isDark = theme === 'dark' || (theme === 'system' && systemDark)
  const CurrentIcon = mounted && isDark ? Moon : Sun

  return (
    <Menu as="div" className={`relative ${compact ? '' : 'ml-1'}`}>
      <Menu.Button
        ref={buttonRef}
        onClick={updatePosition}
        onKeyDown={updatePosition}
        aria-label="切换外观主题"
        className={`ys-icon-btn ${compact ? 'h-8 w-8 rounded-lg' : 'border border-rule bg-sheet'}`}
      >
        <CurrentIcon className={compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'} aria-hidden="true" />
      </Menu.Button>
      {mounted &&
        createPortal(
          <Transition
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 -translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 -translate-y-1"
          >
            <Menu.Items
              style={position}
              className={`ys-sheet fixed z-[100] max-h-[calc(100vh-16px)] w-36 overflow-y-auto p-1 shadow-bar focus:outline-none ${compact ? 'origin-bottom-left' : 'origin-top-right'}`}
            >
              {options.map(({ id, label, Icon }) => (
                <Menu.Item key={id}>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={() => setTheme(id)}
                      aria-current={theme === id ? 'true' : undefined}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${active ? 'bg-paper' : ''} ${theme === id ? 'font-semibold text-brand' : 'text-ink'}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {label}
                    </button>
                  )}
                </Menu.Item>
              ))}
            </Menu.Items>
          </Transition>,
          document.body
        )}
    </Menu>
  )
}

export default ThemeSwitch

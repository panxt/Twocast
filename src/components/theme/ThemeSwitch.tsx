'use client'

import * as React from 'react'
import { Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeContext'

const options = [
  { id: 'light', label: '浅色', Icon: Sun },
  { id: 'dark', label: '深色', Icon: Moon },
  { id: 'system', label: '跟随系统', Icon: Monitor },
] as const

const ThemeSwitch = () => {
  const { theme, setTheme, mounted } = useTheme()
  const [systemDark, setSystemDark] = React.useState(false)

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
    <Menu as="div" className="relative ml-1">
      <Menu.Button aria-label="切换外观主题" className="ys-icon-btn border border-rule bg-sheet">
        <CurrentIcon className="h-[18px] w-[18px]" aria-hidden="true" />
      </Menu.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 -translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 -translate-y-1"
      >
        <Menu.Items className="ys-sheet absolute right-0 z-50 mt-2 w-36 origin-top-right p-1 shadow-bar focus:outline-none">
          {options.map(({ id, label, Icon }) => (
            <Menu.Item key={id}>
              {({ active }) => (
                <button type="button" onClick={() => setTheme(id)} aria-current={theme === id ? 'true' : undefined}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${active ? 'bg-paper' : ''} ${theme === id ? 'font-semibold text-brand' : 'text-ink'}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              )}
            </Menu.Item>
          ))}
        </Menu.Items>
      </Transition>
    </Menu>
  )
}

export default ThemeSwitch

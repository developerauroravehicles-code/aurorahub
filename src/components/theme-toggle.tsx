'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 dark:border-gray-700 dark:bg-white/5 ${className}`}
        aria-hidden
      />
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:border-gray-700 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 transition-colors ${className}`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

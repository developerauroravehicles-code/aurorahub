'use client'

import { ThemeToggle } from '@/components/theme-toggle'

type FixedThemeToggleProps = {
  className?: string
}

/** Fixed top-right theme switch for unauthenticated pages (landing, login). */
export function FixedThemeToggle({ className = '' }: FixedThemeToggleProps) {
  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <ThemeToggle />
    </div>
  )
}

'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'

function foldTypingToLowercase(el: HTMLInputElement) {
  const v = el.value
  const next = v.toLowerCase()
  if (v === next) return
  const start = el.selectionStart
  const end = el.selectionEnd
  el.value = next
  if (start != null && end != null) {
    queueMicrotask(() => {
      try {
        el.setSelectionRange(start, end)
      } catch {
        /* ignore */
      }
    })
  }
}

export type EmailInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/** Email field: forces lowercase as the user types (caret preserved). */
export const EmailInput = forwardRef<HTMLInputElement, EmailInputProps>(function EmailInput(
  { onInput, readOnly, className, autoComplete, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type="email"
      inputMode="email"
      autoComplete={autoComplete ?? 'email'}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      readOnly={readOnly}
      className={className}
      {...props}
      onInput={(e) => {
        if (!readOnly) foldTypingToLowercase(e.currentTarget)
        onInput?.(e)
      }}
    />
  )
})

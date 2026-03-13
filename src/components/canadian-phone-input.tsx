'use client'

/** Format Canadian 10-digit phone as 416 - 123 - 4567. Handles +1 prefix. */
export function formatCanadianPhone(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  digits = digits.slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)} - ${digits.slice(3)}`
  return `${digits.slice(0, 3)} - ${digits.slice(3, 6)} - ${digits.slice(6)}`
}

/** Parse formatted phone to raw 10 digits */
export function parseCanadianPhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10)
}

interface CanadianPhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value?: string
  onChange?: (value: string) => void
}

/** Canadian phone input: formats as 416 - 123 - 4567 while typing */
export function CanadianPhoneInput({
  value,
  onChange,
  className = '',
  placeholder = '416 - 123 - 4567',
  name,
  ...rest
}: CanadianPhoneInputProps) {
  const isControlled = value !== undefined && onChange !== undefined

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const formatted = formatCanadianPhone(input.value)

    if (isControlled) {
      onChange!(formatted)
    } else {
      input.value = formatted
    }
  }

  return (
    <input
      type="tel"
      name={name}
      inputMode="numeric"
      autoComplete="tel"
      placeholder={placeholder}
      value={isControlled ? formatCanadianPhone(value ?? '') : undefined}
      defaultValue={!isControlled ? undefined : undefined}
      onInput={handleInput}
      className={className}
      maxLength={16}
      {...rest}
    />
  )
}

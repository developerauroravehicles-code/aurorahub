type Props = {
  logoDataUrl?: string | null
}

/** Client-safe logo for the public customer portal (data URL from server page). */
export function PortalLogo({ logoDataUrl }: Props) {
  if (!logoDataUrl) {
    return (
      <div
        className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#C27E00]/15 text-2xl font-bold text-[#C27E00]"
        aria-hidden
      >
        A
      </div>
    )
  }

  return (
    <img
      src={logoDataUrl}
      alt="Aurora Vehicles Logo"
      className="max-h-16 w-auto max-w-[200px] object-contain dark:brightness-0 dark:invert"
    />
  )
}

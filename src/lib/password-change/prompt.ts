import { addDays, getPasswordPromptSettings } from './settings'

export type PasswordPromptProfile = {
  password_last_changed_at: string | null
  next_password_prompt_at: string | null
  created_at: string | null
}

export function computePasswordPromptDueAt(
  profile: PasswordPromptProfile,
  intervalDays: number
): Date {
  if (profile.next_password_prompt_at) {
    return new Date(profile.next_password_prompt_at)
  }
  const anchor = profile.password_last_changed_at ?? profile.created_at
  if (!anchor) return new Date(0)
  return addDays(new Date(anchor), intervalDays)
}

export function isPasswordPromptDue(
  profile: PasswordPromptProfile,
  intervalDays: number,
  now = new Date()
): boolean {
  const dueAt = computePasswordPromptDueAt(profile, intervalDays)
  return now.getTime() >= dueAt.getTime()
}

export async function getNextPasswordPromptAtAfterDismiss(): Promise<string> {
  const settings = await getPasswordPromptSettings()
  return addDays(new Date(), settings.intervalDays).toISOString()
}

export async function getNextPasswordPromptAtAfterChange(): Promise<string> {
  const settings = await getPasswordPromptSettings()
  return addDays(new Date(), settings.intervalDays).toISOString()
}

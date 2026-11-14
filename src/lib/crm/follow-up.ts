export type FollowUpKind =
  | 'before_1h'
  | 'at_meeting'
  | 'after_1h'
  | 'after_1d'
  | 'after_3d'
  | 'custom'
  | 'legacy_date'

export const FOLLOW_UP_OPTIONS: {
  kind: FollowUpKind
  label: string
  needsMeeting: boolean
}[] = [
  { kind: 'before_1h', label: '1 hour before meeting', needsMeeting: true },
  { kind: 'at_meeting', label: 'At meeting time', needsMeeting: true },
  { kind: 'after_1h', label: '1 hour after meeting', needsMeeting: true },
  { kind: 'after_1d', label: '1 day after meeting', needsMeeting: true },
  { kind: 'after_3d', label: '3 days after meeting', needsMeeting: true },
  { kind: 'custom', label: 'Custom date & time', needsMeeting: false },
]

const MS_HOUR = 60 * 60 * 1000
const MS_DAY = 24 * MS_HOUR

export function computeRemindAtFromMeeting(
  meetingAtIso: string,
  kind: Exclude<FollowUpKind, 'custom' | 'legacy_date'>
): Date {
  const base = new Date(meetingAtIso)
  if (Number.isNaN(base.getTime())) {
    throw new Error('Invalid meeting time.')
  }

  switch (kind) {
    case 'before_1h':
      return new Date(base.getTime() - MS_HOUR)
    case 'at_meeting':
      return base
    case 'after_1h':
      return new Date(base.getTime() + MS_HOUR)
    case 'after_1d':
      return new Date(base.getTime() + MS_DAY)
    case 'after_3d':
      return new Date(base.getTime() + 3 * MS_DAY)
    default:
      return base
  }
}

export function followUpKindLabel(kind: string | null | undefined): string {
  const found = FOLLOW_UP_OPTIONS.find((o) => o.kind === kind)
  if (found) return found.label
  if (kind === 'legacy_date') return 'Calendar day'
  return kind ?? 'Follow-up'
}
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { OnboardingTaskForm } from './onboarding-task-form'
import { OnboardingTaskActions } from './onboarding-task-actions'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-800 text-zinc-600 dark:text-gray-300 border-zinc-300 dark:border-gray-700',
  in_progress: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
  completed: 'bg-green-900/50 text-green-300 border-green-800',
}

export default async function OnboardingPage() {
  const supabase = await createClient()

  const { data: platformProfiles } = await supabase
    .from('profiles')
    .select('id')
    .is('dealer_id', null)
  const platformIds = platformProfiles?.map(p => p.id) ?? []

  const { data: allTasks } = await supabase
    .from('onboarding_tasks')
    .select('id, profile_id, title, description, status, due_date, sort_order, completed_at, profiles(full_name)')
    .order('profile_id')
    .order('sort_order', { ascending: true })
  const tasks = platformIds.length > 0 && allTasks
    ? allTasks.filter((t) => platformIds.includes(t.profile_id))
    : []

  const { data: employees } = await supabase
    .from('profiles')
    .select('id, full_name')
    .is('dealer_id', null)
    .order('full_name')

  type TaskItem = NonNullable<typeof tasks>[number]
  const tasksByEmployee = (tasks || []).reduce<Record<string, TaskItem[]>>(
    (acc, t) => {
      const pid = t.profile_id
      if (!acc[pid]) acc[pid] = []
      acc[pid].push(t)
      return acc
    },
    {}
  )

  const employeeNames = new Map(
    (employees || []).map((e) => [e.id, e.full_name])
  )
  tasks?.forEach((t) => {
    const name = (t.profiles as { full_name?: string } | null)?.full_name
    if (name) employeeNames.set(t.profile_id, name)
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Onboarding</h1>
        <p className="text-zinc-500 dark:text-gray-400">Manage onboarding checklists for platform employees.</p>
      </div>

      <OnboardingTaskForm employees={employees || []} />

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Onboarding Tasks by Employee</h2>
        <div className="space-y-6">
          {Object.entries(tasksByEmployee).map(([profileId, empTasks]) => (
            <div
              key={profileId}
              className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-4"
            >
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-3">
                {employeeNames.get(profileId) ?? 'Unknown'}
              </h3>
              <ul className="space-y-2">
                {empTasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-gray-800 last:border-0"
                  >
                    <div>
                      <p className="text-zinc-900 dark:text-white font-medium">{t.title}</p>
                      {t.description && (
                        <p className="text-sm text-zinc-500 dark:text-gray-500">{t.description}</p>
                      )}
                      {t.due_date && (
                        <p className="text-xs text-zinc-500 dark:text-gray-500 mt-0.5">
                          Due: {format(new Date(t.due_date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium border ${
                          STATUS_COLORS[t.status] ?? 'bg-gray-800 text-zinc-600 dark:text-gray-300'
                        }`}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                      <OnboardingTaskActions taskId={t.id} status={t.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {Object.keys(tasksByEmployee).length === 0 && (
          <div className="p-8 text-center text-zinc-500 dark:text-gray-400 bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800">
            No onboarding tasks yet.
          </div>
        )}
      </div>
    </div>
  )
}

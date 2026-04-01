import { LogsContent } from './logs-content'

export const dynamic = 'force-dynamic'

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const initialType = type === 'demands' ? 'demands' : type === 'mail' ? 'mail' : 'sms'

  return (
    <div className="bg-zinc-200/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-gray-800 p-6">
      <LogsContent initialType={initialType} />
    </div>
  )
}

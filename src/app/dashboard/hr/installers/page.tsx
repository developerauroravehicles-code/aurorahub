import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function InstallersPage() {
  const supabase = await createClient()
  const [installersRes, completionRes] = await Promise.all([
    supabase.from('installer_profiles').select(`
      id, personnel_id, experience_level, customer_rating, quality_score, installer_status,
      personnel(id, full_name, worker_id)
    `).order('personnel_id'),
    supabase.from('installer_profiles_with_completion').select('personnel_id, completion_rate'),
  ])
  const { data: installers } = installersRes
  const completionMap = new Map((completionRes.data || []).map((r) => [r.personnel_id, r.completion_rate]))
  const installersWithCompletion = (installers || []).map((i) => ({
    ...i,
    completion_rate: completionMap.get(i.personnel_id) ?? null,
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Installer Network</h1>
        <p className="text-gray-400">Technician profiles, service regions, certifications, ratings, and quality scores.</p>
      </div>
      <div className="bg-white/5 rounded-lg border border-gray-800 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-800">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Installer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Experience</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rating</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Quality</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Completion</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {installersWithCompletion?.map((i) => (
              <tr key={i.id} className="hover:bg-white/5">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/hr/personnel/${i.personnel_id}`} className="text-white hover:text-[#C27E00] font-medium">
                    {(i.personnel as { full_name?: string })?.full_name ?? '—'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-400">{i.experience_level || '—'}</td>
                <td className="px-4 py-3 text-gray-400">{i.customer_rating ?? '—'}</td>
                <td className="px-4 py-3 text-gray-400">{i.quality_score ?? '—'}</td>
                <td className="px-4 py-3 text-gray-400">{i.completion_rate != null ? `${i.completion_rate}%` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${i.installer_status === 'active' ? 'bg-green-900/50 text-green-300' : 'bg-gray-800 text-gray-300'}`}>
                    {i.installer_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!installers || installers.length === 0) && (
          <div className="p-8 text-center text-gray-400">No installer profiles. Add personnel with type &quot;Installer Technician&quot; first.</div>
        )}
      </div>
    </div>
  )
}

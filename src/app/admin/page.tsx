import { AdminForms } from './admin-forms'
import { getSystemData } from './actions'
import { AdminTabsContent } from './admin-tabs-content'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const { dealers, profiles, cameras, projectUrl, errors } = await getSystemData()

  return (
    <div className="flex min-h-screen w-full">
      {/* Left Side - Info */}
      <div className="hidden lg:flex w-1/3 bg-black flex-col justify-center items-center text-white p-12 sticky top-0 h-screen">
        <h1 className="text-4xl font-bold mb-4">System Setup</h1>
        <p className="text-lg text-gray-400 text-center mb-8">
          Initialize your database with dealers and users.
        </p>
        <div className="text-xs text-gray-600 break-all text-center">
          Connected to:<br/>
          {projectUrl}
        </div>
      </div>

      {/* Right Side - Forms & Data */}
      <div className="flex flex-col w-full lg:w-2/3 bg-black h-screen overflow-y-auto">
        <div className="p-8">
          <div className="w-full max-w-6xl mx-auto bg-white/5 p-8 rounded-lg shadow-sm border border-gray-800">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white">Admin Console</h2>
              <p className="mt-2 text-sm text-gray-400">Manage initial configuration</p>
            </div>
            <AdminForms dealers={dealers} profiles={profiles} cameras={cameras} errors={errors} />
          </div>
        </div>
      </div>
    </div>
  )
}


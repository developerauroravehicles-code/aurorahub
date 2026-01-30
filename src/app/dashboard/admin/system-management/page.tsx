import { LogoUploadForm } from './logo/logo-upload-form'
import { getSystemLogo } from './logo/actions'
import { SystemManagementTabs } from './system-management-tabs'

export default async function SystemManagementPage() {
  const currentLogo = await getSystemLogo()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6 text-white">System Management</h1>
        
        <SystemManagementTabs activeTab="logo" />

        {/* Tab Content */}
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <LogoManagementContent currentLogo={currentLogo} />
        </div>
      </div>
    </div>
  )
}

async function LogoManagementContent({ currentLogo }: { currentLogo: string | null }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4 text-white">Logo Management</h2>
        <p className="text-gray-400 mb-6">Upload and manage the system logo. Maximum file size: 5MB</p>
        <LogoUploadForm />
      </div>

      {/* Current Logo Display */}
      <div className="mt-8 bg-white/5 rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-medium text-white mb-4">Current Logo</h3>
        <div className="flex items-center justify-center bg-black rounded-lg p-8 min-h-[200px]">
          {currentLogo ? (
            <div className="relative w-full max-w-md h-48 flex items-center justify-center">
              <img
                src={currentLogo}
                alt="System Logo"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : (
            <p className="text-gray-500">No logo uploaded yet</p>
          )}
        </div>
      </div>
    </div>
  )
}

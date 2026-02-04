import { LogoUploadForm } from './logo-upload-form'
import { getSystemLogo } from './actions'
import { SystemManagementTabs } from '../system-management-tabs'

export default async function LogoManagementPage() {
  const currentLogo = await getSystemLogo()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6 text-white">System Management</h1>
        
        <SystemManagementTabs activeTab="logo" />

        {/* Tab Content */}
        <div className="bg-white/5 rounded-lg border border-gray-800 p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Logo Management</h3>
              <p className="text-sm text-gray-400 mb-6">Upload and manage the system logo. Maximum file size: 5MB</p>
              <LogoUploadForm />
            </div>

            {/* Current Logo Display */}
            {currentLogo && (
              <div className="mt-8 bg-white/5 rounded-lg border border-gray-800 p-6">
                <h4 className="text-md font-medium text-white mb-4">Current Logo</h4>
                <div className="flex items-center justify-center bg-black rounded-lg p-8 min-h-[200px]">
                  <div className="relative w-full max-w-md h-48 flex items-center justify-center">
                    <img
                      src={currentLogo}
                      alt="System Logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}



import { getAllCameraModels, createCameraModel, deleteCameraModel, toggleCameraModelStatus } from './actions'
import { CameraManagementContent } from './camera-management-content'

export default async function CameraManagementPage() {
  const cameraModels = await getAllCameraModels()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6 text-white">Camera Management</h1>
        <CameraManagementContent initialCameras={cameraModels} />
      </div>
    </div>
  )
}


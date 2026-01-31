import { DemandForm } from './demand-form'
import { getCameraModels } from './get-cameras'

export default async function NewDemandPage() {
  const cameraModels = await getCameraModels()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-6">Create New Demand</h1>
      <DemandForm cameraModels={cameraModels} />
    </div>
  )
}


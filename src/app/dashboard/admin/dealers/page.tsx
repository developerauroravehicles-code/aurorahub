import { createClient } from '@/lib/supabase/server'
import { createDealer } from './actions'
import { DealerCameraManagement } from './dealer-camera-management'

export default async function DealersPage() {
  const supabase = await createClient()
  const { data: dealers } = await supabase
    .from('dealers')
    .select(`
      *,
      dealer_cameras(
        camera_model_id,
        camera_models(id, name, is_active)
      )
    `)
    .order('created_at')
  
  const { data: cameraModels } = await supabase
    .from('camera_models')
    .select('*')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-4 text-white">Dealers</h1>
        <div className="bg-white/5 rounded-lg border border-gray-800 shadow overflow-hidden">
            <ul className="divide-y divide-gray-800">
                {dealers?.map(d => (
                    <li key={d.id} className="px-4 py-4 hover:bg-white/5 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-bold text-white">{d.name} <span className="text-sm font-normal text-gray-400">({d.code})</span></p>
                            <p className="text-sm text-gray-500">{d.address}</p>
                            {d.dealer_cameras && d.dealer_cameras.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-gray-400 mb-1">Assigned Cameras:</p>
                                <div className="flex flex-wrap gap-1">
                                  {d.dealer_cameras.map((dc: any) => (
                                    <span 
                                      key={dc.camera_model_id} 
                                      className="text-xs px-2 py-1 bg-[#C27E00]/20 text-[#C27E00] rounded border border-[#C27E00]/30"
                                    >
                                      {dc.camera_models?.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <DealerCameraManagement 
                            dealerId={d.id} 
                            dealerName={d.name}
                            assignedCameras={d.dealer_cameras || []}
                            allCameras={cameraModels || []}
                          />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
      </div>

      <div className="bg-white/5 p-6 rounded-lg border border-gray-800 shadow max-w-lg">
          <h2 className="text-lg font-medium mb-4 text-white">Add New Dealer</h2>
          <form action={createDealer} className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-gray-300">Dealer Name</label>
                  <input name="name" required className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]" />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-300">Dealer Code</label>
                  <input name="code" required className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] placeholder-gray-500" placeholder="e.g. KIASURREY" />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-300">Address</label>
                  <input name="address" className="border border-gray-700 bg-white/5 p-2 w-full rounded text-white focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]" />
              </div>
              <button className="bg-[#C27E00] text-white px-4 py-2 rounded hover:bg-[#a06900] transition-colors">Add Dealer</button>
          </form>
      </div>
    </div>
  )
}

